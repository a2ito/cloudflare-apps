/** 計測値を残す日数。これより古いものは受信のたびに消す */
export const RETENTION_DAYS = 30;

/**
 * 最後の受信からこれだけ空いたら「オフライン」と表示する。
 * エージェントは 1 分ごとに送るので、数回の取りこぼしは許す。
 */
export const OFFLINE_AFTER_MS = 5 * 60 * 1000;

/** 端末の時計のずれとして許す未来の幅。これより先の計測時刻は捨てる */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export const MAX_DEVICES_PER_USER = 20;
export const MAX_DEVICE_NAME_LENGTH = 40;
export const MAX_NETWORK_NAME_LENGTH = 40;

/** 受信 API が受け付ける本文の上限（300 件 × 1 件 250 バイト程度に余裕を持たせる） */
export const MAX_REQUEST_BYTES = 256 * 1024;

export const RANGES = {
  "24h": { label: "24 時間", seconds: 24 * 60 * 60, bucketSeconds: 5 * 60 },
  "7d": { label: "7 日", seconds: 7 * 24 * 60 * 60, bucketSeconds: 30 * 60 },
} as const;

export type RangeKey = keyof typeof RANGES;

export function parseRange(value: unknown): RangeKey {
  return value === "7d" ? "7d" : "24h";
}
