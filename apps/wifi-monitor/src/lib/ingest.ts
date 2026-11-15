import type { Db } from "@/db";
import {
  findDeviceByTokenHash,
  insertSamples,
  pruneSamples,
  touchDevice,
  type SampleRow,
} from "@/db/queries";
import { MAX_CLOCK_SKEW_MS, RETENTION_DAYS } from "./limits";
import { samplesPayloadSchema, type SampleInput } from "./sample-schema";
import { hashToken, parseBearerToken } from "./token";

export type IngestResult =
  | { ok: true; accepted: number; skipped: number }
  | { ok: false; status: 400 | 401; error: string };

export function retentionCutoff(now: Date): string {
  return new Date(
    now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

/**
 * 保存する行に直す。保存期間より古いもの・未来すぎるもの（端末の時計の狂い）は null。
 * 計測時刻は UTC の ISO 文字列にそろえる（文字列のまま並べ替え・比較するため）。
 */
function toRow(
  sample: SampleInput,
  now: Date,
  cutoff: string,
): SampleRow | null {
  const measuredAt = new Date(sample.measuredAt).toISOString();
  if (measuredAt < cutoff) return null;
  if (new Date(measuredAt).getTime() > now.getTime() + MAX_CLOCK_SKEW_MS) {
    return null;
  }
  return {
    measuredAt,
    ssid: sample.ssid ?? null,
    rssi: sample.rssi ?? null,
    noise: sample.noise ?? null,
    txRateMbps: sample.txRateMbps ?? null,
    latencyMs: sample.latencyMs ?? null,
    packetLossPct: sample.packetLossPct ?? null,
    downloadMbps: sample.downloadMbps ?? null,
  };
}

/**
 * エージェントからの計測値を受け取って保存する。
 *
 * - トークンが無い・合わない → 401
 * - 本文の形が違う → 400（1 件でも壊れていれば全体を弾く。エージェントのバグに気づけるように）
 * - 古すぎる・未来すぎる計測は黙って飛ばし、skipped に数える（再送しても入らないので、エラーにすると延々と再送される）
 * - 既に入っている計測（再送）も skipped に数える
 */
export async function ingestSamples(
  db: Db,
  input: { authorization: string | null; body: unknown; now: Date },
): Promise<IngestResult> {
  const token = parseBearerToken(input.authorization);
  if (!token) return { ok: false, status: 401, error: "トークンがありません" };
  const device = await findDeviceByTokenHash(db, await hashToken(token));
  if (!device) {
    return { ok: false, status: 401, error: "トークンが正しくありません" };
  }

  const parsed = samplesPayloadSchema.safeParse(input.body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: `計測値の形が正しくありません: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    };
  }

  const cutoff = retentionCutoff(input.now);
  const rows = parsed.data.samples
    .map((s) => toRow(s, input.now, cutoff))
    .filter((r): r is SampleRow => r !== null);

  const accepted = await insertSamples(db, device.id, rows);
  await touchDevice(db, device.id, input.now.toISOString());
  // 古い計測は受信のついでに消す。Cron を持たずに済み、端末の索引で引くので軽い
  await pruneSamples(db, device.id, cutoff);

  return {
    ok: true,
    accepted,
    skipped: parsed.data.samples.length - accepted,
  };
}
