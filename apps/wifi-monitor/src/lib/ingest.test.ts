import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDevice,
  getDevice,
  getLatestSample,
  getSeries,
  upsertUser,
} from "@/db/queries";
import { createTestEnv, type TestEnv } from "@/test/d1";
import { authenticateDevice, ingestSamples } from "./ingest";
import { MAX_SAMPLES_PER_REQUEST } from "./sample-schema";
import { hashToken } from "./token";

let t: TestEnv;
beforeAll(async () => {
  t = await createTestEnv();
});
afterAll(() => t.dispose());

const TOKEN = "wfm_test-token";
const now = new Date("2026-11-15T03:00:00.000Z");
let deviceId: number;

beforeEach(async () => {
  await t.truncate();
  const user = await upsertUser(t.db, {
    email: "tester@example.com",
    name: null,
    image: null,
  });
  const device = await createDevice(t.db, user.id, {
    name: "Mac",
    tokenHash: await hashToken(TOKEN),
  });
  deviceId = device.id;
});

async function countSamples(): Promise<number> {
  const row = await t.d1
    .prepare("SELECT count(*) AS n FROM samples")
    .first<{ n: number }>();
  return row?.n ?? 0;
}

const sample = (measuredAt: string, extra: Record<string, unknown> = {}) => ({
  measuredAt,
  ssid: "home",
  rssi: -55,
  latencyMs: 12.3,
  packetLossPct: 0,
  ...extra,
});

/** route と同じ順に、認証してから保存する */
const ingest = async (
  body: unknown,
  authorization: string | null = `Bearer ${TOKEN}`,
) => {
  const auth = await authenticateDevice(t.db, authorization);
  if (!auth.ok) return auth;
  return ingestSamples(t.db, { device: auth.device, body, now });
};

describe("ingestSamples", () => {
  it("計測値を保存し、端末の最終受信時刻を更新する", async () => {
    const result = await ingest({
      samples: [
        sample("2026-11-15T02:59:00Z"),
        sample("2026-11-15T11:58:00+09:00"),
      ],
    });
    expect(result).toEqual({ ok: true, accepted: 2, skipped: 0 });

    // タイムゾーン付きの時刻も UTC にそろえて保存する
    expect(await getLatestSample(t.db, deviceId)).toMatchObject({
      measuredAt: "2026-11-15T02:59:00.000Z",
      ssid: "home",
      rssi: -55,
      latencyMs: 12.3,
      noise: null,
      downloadMbps: null,
    });
    const device = await getDevice(t.db, 1, deviceId);
    expect(device?.lastSeenAt).toBe(now.toISOString());
  });

  it("再送された計測は二重に入れない", async () => {
    const body = { samples: [sample("2026-11-15T02:59:00Z")] };
    await ingest(body);
    expect(await ingest(body)).toEqual({ ok: true, accepted: 0, skipped: 1 });
    expect(await countSamples()).toBe(1);
  });

  it("1 文に入りきらない件数（10 件超）もまとめて入る", async () => {
    const samples = Array.from({ length: 123 }, (_, i) =>
      sample(new Date(now.getTime() - (i + 1) * 60_000).toISOString()),
    );
    expect(await ingest({ samples })).toEqual({
      ok: true,
      accepted: 123,
      skipped: 0,
    });
  });

  it("保存期間より古い計測と、未来すぎる計測は飛ばす", async () => {
    const result = await ingest({
      samples: [
        sample("2026-10-01T00:00:00Z"),
        sample("2026-11-15T03:10:00Z"),
        sample("2026-11-15T03:04:00Z"), // 時計のずれとして許す範囲
      ],
    });
    expect(result).toEqual({ ok: true, accepted: 1, skipped: 2 });
  });

  it("保存期間を過ぎた計測を受信のついでに消す", async () => {
    await t.d1
      .prepare("INSERT INTO samples (device_id, measured_at) VALUES (?, ?)")
      .bind(deviceId, "2026-10-01T00:00:00.000Z")
      .run();
    await ingest({ samples: [sample("2026-11-15T02:59:00Z")] });
    expect(await countSamples()).toBe(1);
  });

  it.each([
    [null, "トークンがありません"],
    ["Bearer wfm_wrong", "トークンが正しくありません"],
    [`Basic ${TOKEN}`, "トークンがありません"],
  ])("トークンが %j なら 401", async (authorization, error) => {
    expect(
      await ingest(
        { samples: [sample("2026-11-15T02:59:00Z")] },
        authorization,
      ),
    ).toEqual({
      ok: false,
      status: 401,
      error,
    });
    expect(await countSamples()).toBe(0);
  });

  it.each([[{}], [{ samples: [] }], [[]], [null]])(
    "形が違う本文 %j は 400",
    async (body) => {
      expect(await ingest(body)).toMatchObject({ ok: false, status: 400 });
    },
  );

  it.each([
    [sample("not-a-date")],
    [sample("2026-11-15T02:59:00Z", { rssi: 10 })],
    [sample("2026-11-15T02:59:00Z", { packetLossPct: 101 })],
    [sample("2026-11-15T02:59:00Z", { latencyMs: "12" })],
    [sample("2026-11-15T02:59:00Z", { ssid: "x".repeat(33) })],
  ])(
    "壊れた計測 %j が 1 件でも混じれば 400 で、1 件も入れない",
    async (bad) => {
      const result = await ingest({
        samples: [sample("2026-11-15T02:58:00Z"), bad],
      });
      expect(result).toMatchObject({ ok: false, status: 400 });
      expect(await countSamples()).toBe(0);
    },
  );

  it(`${MAX_SAMPLES_PER_REQUEST + 1} 件以上は 400`, async () => {
    const samples = Array.from(
      { length: MAX_SAMPLES_PER_REQUEST + 1 },
      (_, i) => sample(new Date(now.getTime() - i * 1000).toISOString()),
    );
    expect(await ingest({ samples })).toMatchObject({ ok: false, status: 400 });
  });
});

describe("getSeries", () => {
  it("区間ごとの平均にまとめ、時刻順に返す", async () => {
    await ingest({
      samples: [
        sample("2026-11-15T02:00:00Z", { latencyMs: 10, rssi: -50 }),
        sample("2026-11-15T02:04:00Z", { latencyMs: 20, rssi: -60 }),
        sample("2026-11-15T02:05:00Z", { latencyMs: 30, rssi: null }),
        sample("2026-11-15T00:00:00Z", { latencyMs: 99 }),
      ],
    });
    const series = await getSeries(
      t.db,
      { deviceId },
      "2026-11-15T01:00:00.000Z",
      300,
    );
    const base = Date.parse("2026-11-15T02:00:00Z") / 1000;
    expect(series).toEqual([
      expect.objectContaining({ t: base, count: 2, latencyMs: 15, rssi: -55 }),
      expect.objectContaining({
        t: base + 300,
        count: 1,
        latencyMs: 30,
        rssi: null,
      }),
    ]);
  });
});
