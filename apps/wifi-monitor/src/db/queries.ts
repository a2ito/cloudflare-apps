import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { Db } from "./index";
import {
  devices,
  networks,
  samples,
  users,
  type Device,
  type Network,
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

/* ── networks ──────────────────────────────────────────────── */

/**
 * 1 文に入れるネットワークの行数。バインドされるのは 1 行 3 個（user_id・ssid・name）で、
 * D1 の 1 文 100 個の上限から 33 行。
 */
const NETWORKS_PER_INSERT = 33;

/**
 * SSID からネットワークの ID を引く。まだ無い SSID は、その名前のネットワークとして作る。
 *
 * 移動しながら溜めた計測をまとめて送ると SSID が何十種類にもなるので、INSERT は分けて流し、
 * 引く側は SSID を条件に並べず（バインドの上限に当たるため）持ち主のネットワークを全部引いて照合する。
 * 1 回の受信の最大 300 件がすべて別の SSID でも、INSERT 10 文 + SELECT 1 文で済む。
 */
export async function ensureNetworks(
  db: Db,
  userId: number,
  ssids: readonly string[],
): Promise<Map<string, number>> {
  const unique = [...new Set(ssids)];
  if (unique.length === 0) return new Map();
  for (let i = 0; i < unique.length; i += NETWORKS_PER_INSERT) {
    await db
      .insert(networks)
      .values(
        unique
          .slice(i, i + NETWORKS_PER_INSERT)
          .map((ssid) => ({ userId, ssid, name: ssid })),
      )
      .onConflictDoNothing();
  }
  const wanted = new Set(unique);
  const rows = await db
    .select({ id: networks.id, ssid: networks.ssid })
    .from(networks)
    .where(eq(networks.userId, userId));
  return new Map(
    rows.filter((r) => wanted.has(r.ssid)).map((r) => [r.ssid, r.id]),
  );
}

/** 持ち主のネットワークだけ返す。他人のネットワークの ID なら null */
export async function getNetwork(
  db: Db,
  userId: number,
  id: number,
): Promise<Network | null> {
  const [row] = await db
    .select()
    .from(networks)
    .where(and(eq(networks.id, id), eq(networks.userId, userId)));
  return row ?? null;
}

/** 持ち主のものだけ名前を変える。変えられたら true */
export async function renameNetwork(
  db: Db,
  userId: number,
  id: number,
  name: string,
): Promise<boolean> {
  const updated = await db
    .update(networks)
    .set({ name })
    .where(and(eq(networks.id, id), eq(networks.userId, userId)))
    .returning({ id: networks.id });
  return updated.length > 0;
}

export type NetworkWithStats = Network & {
  /** 残っている計測のうち最新の計測時刻。保存期間を過ぎて計測が消えたら null */
  lastMeasuredAt: string | null;
};

/**
 * 持ち主のネットワークを、最近計測した順（計測の無いものは後ろ）に返す。
 *
 * 最新の計測時刻はネットワークごとに (network_id, measured_at) の索引で 1 行だけ引く。
 * 計測を結合して集計すると、ホームを開くたびに持ち主の 30 日分の計測をほぼ全部読むことになるため。
 */
export async function listNetworksWithStats(
  db: Db,
  userId: number,
): Promise<NetworkWithStats[]> {
  // 列はテーブル名つきで書く。drizzle は 1 表のクエリでテーブル名を省くので、${networks.id} のままだと
  // サブクエリの中で samples.id と取り違えられる
  const lastMeasuredAt = sql<
    string | null
  >`(select s.measured_at from samples s where s.network_id = "networks"."id" order by s.measured_at desc limit 1)`;
  return db
    .select({
      id: networks.id,
      userId: networks.userId,
      ssid: networks.ssid,
      name: networks.name,
      createdAt: networks.createdAt,
      lastMeasuredAt: lastMeasuredAt.as("last_measured_at"),
    })
    .from(networks)
    .where(eq(networks.userId, userId))
    .orderBy(
      sql`last_measured_at is null`,
      sql`last_measured_at desc`,
      asc(networks.id),
    );
}

/* ── samples ───────────────────────────────────────────────── */

export type SampleRow = Omit<typeof samples.$inferInsert, "id" | "deviceId">;

/**
 * D1 は 1 文のバインド変数が 100 個までなので、列数から 1 文に入る行数を決める。
 * 1 行 10 個（device_id と計測値 9 列）× 9 行 = 90 個。ちょうど 100 は上限の解釈に頼るので避ける。
 * 1 回の受信（300 件）で 34 文になり、Free プランの 1 起動あたりのクエリ数（50）に収まる
 */
const ROWS_PER_INSERT = 9;

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

/** グラフにする計測の範囲。端末単位か、ネットワーク単位（複数の端末の計測をまとめる） */
export type SeriesTarget = { deviceId: number } | { networkId: number };

/**
 * グラフ用に、計測値を bucketSeconds ごとの平均にまとめて返す。
 *
 * 1 分ごとの計測を 7 日分そのまま返すと 1 万点を超え、描いても潰れて見えないため。
 * 計測の無い区間は行が無い（グラフでは線を切って、途切れたことが分かるようにする）。
 * 端末・ネットワークが持ち主のものかは呼び出し側（getDevice / getNetwork）で確かめておく。
 * ネットワークの計測は、持ち主の端末から届いたものしか付かない（ensureNetworks は端末の持ち主で作る）。
 */
export async function getSeries(
  db: Db,
  target: SeriesTarget,
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
    .where(
      and(
        "deviceId" in target
          ? eq(samples.deviceId, target.deviceId)
          : eq(samples.networkId, target.networkId),
        gte(samples.measuredAt, since),
      ),
    )
    .groupBy(sql`t`)
    .orderBy(sql`t`);
}
