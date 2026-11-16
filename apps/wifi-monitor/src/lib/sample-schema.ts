import { z } from "zod";

/**
 * エージェントが送る計測値の形。受信 API とエージェント（agent/）の両方がこれを使う。
 *
 * 範囲は「機器が返しうる値」より少し広く取り、明らかな壊れた値（単位違いなど）だけを弾く。
 */

/**
 * 1 回の送信で受け付ける計測の最大件数。オフラインの間に溜めた分は分けて送ってもらう。
 *
 * Workers の Free プランは 1 回の起動で D1 へのクエリが 50 まで。300 件なら、計測の挿入が 34 文（9 行ずつ）、
 * ネットワークの登録が最大 11 文（全部別の SSID のとき）、ほかに認証・最終受信の更新・古い計測の削除で、最大 48 に収まる。
 */
export const MAX_SAMPLES_PER_REQUEST = 300;

const optionalNumber = (min: number, max: number) =>
  z.number().finite().min(min).max(max).nullish();

const optionalInt = (min: number, max: number) =>
  z.number().int().min(min).max(max).nullish();

export const sampleSchema = z.object({
  /** ISO 8601。タイムゾーン付きでもよい。保存するときに UTC にそろえる */
  measuredAt: z.iso.datetime({ offset: true }),
  // SSID は最大 32 バイト。UTF-8 なら 32 文字以内に収まる
  ssid: z.string().trim().min(1).max(32).nullish(),
  rssi: optionalInt(-120, 0),
  noise: optionalInt(-120, 0),
  txRateMbps: optionalNumber(0, 100_000),
  latencyMs: optionalNumber(0, 60_000),
  packetLossPct: optionalNumber(0, 100),
  downloadMbps: optionalNumber(0, 100_000),
});

export const samplesPayloadSchema = z.object({
  samples: z.array(sampleSchema).min(1).max(MAX_SAMPLES_PER_REQUEST),
});

export type SampleInput = z.infer<typeof sampleSchema>;
export type SamplesPayload = z.infer<typeof samplesPayloadSchema>;
