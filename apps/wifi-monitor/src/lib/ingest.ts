import type { Db } from "@/db";
import type { Device } from "@/db/schema";
import {
  ensureNetworks,
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
  | { ok: false; status: 400; error: string };

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

export type AuthResult =
  { ok: true; device: Device } | { ok: false; status: 401; error: string };

/**
 * Authorization ヘッダから端末を引く。本文を読む前に呼ぶ
 * （トークンを持たない相手に本文を読ませないため）。
 */
export async function authenticateDevice(
  db: Db,
  authorization: string | null,
): Promise<AuthResult> {
  const token = parseBearerToken(authorization);
  if (!token) return { ok: false, status: 401, error: "トークンがありません" };
  const device = await findDeviceByTokenHash(db, await hashToken(token));
  if (!device) {
    return { ok: false, status: 401, error: "トークンが正しくありません" };
  }
  return { ok: true, device };
}

/**
 * 認証済みの端末から届いた計測値を保存する。
 *
 * - 本文の形が違う → 400（1 件でも壊れていれば全体を弾く。エージェントのバグに気づけるように）
 * - 古すぎる・未来すぎる計測は黙って飛ばし、skipped に数える（再送しても入らないので、エラーにすると延々と再送される）
 * - 既に入っている計測（再送）も skipped に数える
 */
export async function ingestSamples(
  db: Db,
  input: { device: Device; body: unknown; now: Date },
): Promise<IngestResult> {
  const { device } = input;
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

  // 初めて見た SSID はネットワークとして自動で作り、計測をひも付ける
  const networkIds = await ensureNetworks(
    db,
    device.userId,
    rows.flatMap((r) => (r.ssid ? [r.ssid] : [])),
  );
  const withNetwork = rows.map((r) => ({
    ...r,
    networkId: r.ssid ? (networkIds.get(r.ssid) ?? null) : null,
  }));

  const accepted = await insertSamples(db, device.id, withNetwork);
  // 全件が飛ばされても更新する。エージェントは動いているので「オンライン」で正しい
  await touchDevice(db, device.id, input.now.toISOString());
  // 古い計測は受信のついでに消す。Cron を持たずに済み、端末の索引で引くので軽い。
  // 送信が止まった端末の計測は残るが、端末を消せば消える
  await pruneSamples(db, device.id, cutoff);

  return {
    ok: true,
    accepted,
    skipped: parsed.data.samples.length - accepted,
  };
}
