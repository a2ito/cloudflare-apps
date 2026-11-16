import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

/** ログインした Google アカウント。端末の持ち主 */
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    name: text("name"),
    image: text("image"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

/**
 * 計測するエージェントを動かす端末 1 台。
 *
 * エージェントは Google ログインできないので、端末ごとに発行したトークンで受信 API を叩く。
 * トークンそのものは保存せず SHA-256 のハッシュだけを持つ（DB が漏れても送信を偽装されないため）。
 */
export const devices = sqliteTable(
  "devices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    /** 最後に計測値を受け取った時刻（ISO 8601, UTC）。オフラインの判定に使う */
    lastSeenAt: text("last_seen_at"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("devices_token_hash_idx").on(t.tokenHash),
    index("devices_user_idx").on(t.userId),
  ],
);

/**
 * 計測したネットワーク。SSID ごとに 1 件で、持ち主の端末が初めて送ってきた SSID から自動で作る。
 *
 * 端末は持ち歩くとネットワークが変わるので、端末とは別にネットワーク単位でも計測を見られるようにする。
 * name は表示名で、最初は SSID と同じ。画面で「自宅」などに付け替える。
 */
export const networks = sqliteTable(
  "networks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ssid: text("ssid").notNull(),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("networks_user_ssid_idx").on(t.userId, t.ssid)],
);

/**
 * 計測値 1 件。
 *
 * Wi-Fi の情報（SSID・RSSI など）は OS や権限によって取れないことがあるので、すべて null を許す。
 * 有線の端末から遅延だけ送るといった使い方もできる。
 */
export const samples = sqliteTable(
  "samples",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deviceId: integer("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    /** 端末で計測した時刻（ISO 8601, UTC, ミリ秒まで）。受信時刻ではない（溜めて後から送るため） */
    measuredAt: text("measured_at").notNull(),
    ssid: text("ssid"),
    /** 受信強度（dBm） */
    rssi: integer("rssi"),
    /** ノイズ（dBm） */
    noise: integer("noise"),
    /** リンク速度（Mbps） */
    txRateMbps: real("tx_rate_mbps"),
    /** 往復遅延（ms） */
    latencyMs: real("latency_ms"),
    /** パケット損失率（%） */
    packetLossPct: real("packet_loss_pct"),
    /** ダウンロード速度（Mbps）。重いので低頻度でしか計測しない */
    downloadMbps: real("download_mbps"),
    /**
     * 計測したときのネットワーク（networks.id）。SSID が取れなかった計測は null。
     *
     * 外部キーは付けない。既存の表への列の追加は ALTER TABLE になり、drizzle-kit がそこで
     * ON DELETE を落とすため（付けると networks を消せなくなる）。ネットワークを消す操作は無く、
     * ユーザを消すときは devices 経由で計測も消えるので、宙に浮いた ID は残らない
     */
    networkId: integer("network_id"),
  },
  (t) => [
    // 同じ計測を再送しても二重にならないようにする（送信が途中で切れたら丸ごと送り直すため）。
    // 期間で絞るグラフの読み出しと、古い計測の削除もこの索引で引く
    uniqueIndex("samples_device_measured_at_idx").on(t.deviceId, t.measuredAt),
    // ネットワーク単位のグラフを期間で絞って引く
    index("samples_network_measured_at_idx").on(t.networkId, t.measuredAt),
  ],
);

export type User = typeof users.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type Sample = typeof samples.$inferSelect;
export type Network = typeof networks.$inferSelect;
