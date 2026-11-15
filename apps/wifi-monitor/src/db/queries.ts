import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { Db } from "./index";
import {
  devices,
  samples,
  users,
  type Device,
  type Sample,
  type User,
} from "./schema";

/* ── users ─────────────────────────────────────────────────── */

export async function upsertUser(
  db: Db,
  profile: { email: string; name: string | null; image: string | null },
): Promise<User> {
  const email = profile.email.trim().toLowerCase();
  const [row] = await db
    .insert(users)
    .values({ email, name: profile.name, image: profile.image })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: profile.name, image: profile.image },
    })
    .returning();
  if (!row) throw new Error("ユーザの保存に失敗しました");
  return row;
}

/* ── devices ───────────────────────────────────────────────── */

export async function createDevice(
  db: Db,
  userId: number,
  input: { name: string; tokenHash: string },
): Promise<Device> {
  const [row] = await db
    .insert(devices)
    .values({ userId, ...input })
    .returning();
  if (!row) throw new Error("端末の保存に失敗しました");
  return row;
}

export async function countDevices(db: Db, userId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(devices)
    .where(eq(devices.userId, userId));
  return row?.n ?? 0;
}

export type DeviceWithLatest = Device & { latest: Sample | null };

/** 持ち主の端末を、登録した順に最新の計測値つきで返す */
export async function listDevicesWithLatest(
  db: Db,
  userId: number,
): Promise<DeviceWithLatest[]> {
  const rows = await db
    .select()
    .from(devices)
    .where(eq(devices.userId, userId))
    .orderBy(asc(devices.id));
  // 端末は数台なので 1 台ずつ引く。最新は id ではなく計測時刻で決める（溜めた分が後から届くため）
  return Promise.all(
    rows.map(async (device) => ({
      ...device,
      latest: await getLatestSample(db, device.id),
    })),
  );
}

/** 持ち主の端末だけ返す。他人の端末の ID なら null */
export async function getDevice(
  db: Db,
  userId: number,
  id: number,
): Promise<Device | null> {
  const [row] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, id), eq(devices.userId, userId)));
  return row ?? null;
}

/** 持ち主のものだけ消す。計測値も cascade で消える */
export async function deleteDevice(
  db: Db,
  userId: number,
  id: number,
): Promise<boolean> {
  const deleted = await db
    .delete(devices)
    .where(and(eq(devices.id, id), eq(devices.userId, userId)))
    .returning({ id: devices.id });
  return deleted.length > 0;
}

export async function findDeviceByTokenHash(
  db: Db,
  tokenHash: string,
): Promise<Device | null> {
  const [row] = await db
    .select()
    .from(devices)
    .where(eq(devices.tokenHash, tokenHash));
  return row ?? null;
}

export async function touchDevice(
  db: Db,
  deviceId: number,
  seenAt: string,
): Promise<void> {
  await db
    .update(devices)
    .set({ lastSeenAt: seenAt })
    .where(eq(devices.id, deviceId));
}

/* ── samples ───────────────────────────────────────────────── */

export type SampleRow = Omit<typeof samples.$inferInsert, "id" | "deviceId">;

/**
 * D1 は 1 文のバインド変数が 100 個までなので、列数（9）から 1 文に入る行数を決める。
 * 1 行 9 個 × 10 行 = 90 個。
 */
const ROWS_PER_INSERT = 10;

/** 計測値を入れる。同じ端末・同じ計測時刻のものは既にあれば飛ばす。入った件数を返す */
export async function insertSamples(
  db: Db,
  deviceId: number,
  rows: readonly SampleRow[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const chunks: SampleRow[][] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
    chunks.push(rows.slice(i, i + ROWS_PER_INSERT));
  }
  const statements = chunks.map((chunk) =>
    db
      .insert(samples)
      .values(chunk.map((row) => ({ ...row, deviceId })))
      .onConflictDoNothing()
      .returning({ id: samples.id }),
  );
  const [first, ...rest] = statements;
  if (!first) return 0;
  // batch はまとめて 1 トランザクションになる。途中で落ちても半端に入らない
  const results = await db.batch([first, ...rest]);
  return results.reduce((sum, inserted) => sum + inserted.length, 0);
}

/** 保存期間を過ぎた計測値を消す。消した件数を返す */
export async function pruneSamples(
  db: Db,
  deviceId: number,
  before: string,
): Promise<number> {
  const deleted = await db
    .delete(samples)
    .where(and(eq(samples.deviceId, deviceId), lt(samples.measuredAt, before)))
    .returning({ id: samples.id });
  return deleted.length;
}

export async function getLatestSample(
  db: Db,
  deviceId: number,
): Promise<Sample | null> {
  const [row] = await db
    .select()
    .from(samples)
    .where(eq(samples.deviceId, deviceId))
    .orderBy(desc(samples.measuredAt))
    .limit(1);
  return row ?? null;
}

export type SeriesPoint = {
  /** 区間の始まり（UNIX 秒） */
  t: number;
  count: number;
  rssi: number | null;
  latencyMs: number | null;
  packetLossPct: number | null;
  downloadMbps: number | null;
  txRateMbps: number | null;
};

/**
 * グラフ用に、計測値を bucketSeconds ごとの平均にまとめて返す。
 *
 * 1 分ごとの計測を 7 日分そのまま返すと 1 万点を超え、描いても潰れて見えないため。
 * 計測の無い区間は行が無い（グラフでは線を切って、途切れたことが分かるようにする）。
 * 端末が持ち主のものかは呼び出し側（getDevice）で確かめておく。
 */
export async function getSeries(
  db: Db,
  deviceId: number,
  since: string,
  bucketSeconds: number,
): Promise<SeriesPoint[]> {
  if (!Number.isInteger(bucketSeconds) || bucketSeconds <= 0) {
    throw new Error(`bucketSeconds は正の整数にしてください: ${bucketSeconds}`);
  }
  // 区間幅はバインドせず SQL に埋める。D1 は JS の数値を REAL で渡すため、バインドすると
  // 整数の割り算（切り捨て）にならず区間にまとまらない。上で正の整数だと確かめてある
  const width = sql.raw(String(bucketSeconds));
  const bucket = sql<number>`(cast(strftime('%s', ${samples.measuredAt}) as integer) / ${width}) * ${width}`;
  return db
    .select({
      t: bucket.as("t"),
      count: sql<number>`count(*)`,
      rssi: sql<number | null>`avg(${samples.rssi})`,
      latencyMs: sql<number | null>`avg(${samples.latencyMs})`,
      packetLossPct: sql<number | null>`avg(${samples.packetLossPct})`,
      downloadMbps: sql<number | null>`avg(${samples.downloadMbps})`,
      txRateMbps: sql<number | null>`avg(${samples.txRateMbps})`,
    })
    .from(samples)
    .where(and(eq(samples.deviceId, deviceId), gte(samples.measuredAt, since)))
    .groupBy(sql`t`)
    .orderBy(sql`t`);
}
