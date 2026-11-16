import { z } from "zod";

/**
 * エージェントの設定。環境変数（launchd / systemd が設定ファイルから渡す）から読む。
 */
const configSchema = z.object({
  /**
   * wifi-monitor の URL（例: https://wifi-monitor.a2ito.work）。
   * トークンを平文で流さないよう、http は手元の開発用の localhost だけ許す
   */
  WIFI_MONITOR_URL: z.url({ protocol: /^https?$/ }).refine((raw) => {
    const url = new URL(raw);
    return (
      url.protocol === "https:" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  }, "https の URL を指定してください（http は localhost だけ）"),
  /** 端末を登録したときに表示されたトークン */
  WIFI_MONITOR_TOKEN: z.string().startsWith("wfm_"),
  /** 計測の間隔（秒） */
  WIFI_MONITOR_INTERVAL_SECONDS: z.coerce.number().int().min(10).default(60),
  /** 遅延・損失を計る ping の宛先。- で始まるとオプションとして読まれるので弾く */
  WIFI_MONITOR_PING_HOST: z
    .string()
    .regex(/^[A-Za-z0-9.:[\]-]+$/)
    .refine((v) => !v.startsWith("-"), "ping の宛先が正しくありません")
    .default("1.1.1.1"),
  /** 1 回の計測で送る ping の数 */
  WIFI_MONITOR_PING_COUNT: z.coerce.number().int().min(1).max(20).default(5),
  /** ダウンロード速度を計る間隔（分）。0 なら計らない */
  WIFI_MONITOR_SPEED_INTERVAL_MINUTES: z.coerce
    .number()
    .int()
    .min(0)
    .default(60),
  /** ダウンロード速度の計測で落とす量（バイト） */
  WIFI_MONITOR_SPEED_BYTES: z.coerce
    .number()
    .int()
    .min(100_000)
    .max(100_000_000)
    .default(10_000_000),
  /** Wi-Fi のインタフェース名。省略すると自動で探す */
  WIFI_MONITOR_INTERFACE: z.string().min(1).optional(),
  /** 送れなかった計測を貯めておくファイル */
  WIFI_MONITOR_QUEUE_FILE: z.string().min(1).optional(),
});

export type Config = {
  url: string;
  token: string;
  intervalMs: number;
  pingHost: string;
  pingCount: number;
  /** 0 なら計らない */
  speedIntervalMs: number;
  speedBytes: number;
  interfaceName: string | undefined;
  queueFile: string;
};

export function parseConfig(
  env: Record<string, string | undefined>,
  defaultQueueFile: string,
): Config {
  // 空文字は「書いていない」と同じに扱う（設定ファイルの雛形の空欄をそのまま残せるように）
  const cleaned = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v.trim() !== ""),
  );
  const parsed = configSchema.safeParse(cleaned);
  if (!parsed.success) {
    throw new Error(
      `設定が正しくありません: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  const c = parsed.data;
  return {
    url: c.WIFI_MONITOR_URL.replace(/\/+$/, ""),
    token: c.WIFI_MONITOR_TOKEN,
    intervalMs: c.WIFI_MONITOR_INTERVAL_SECONDS * 1000,
    pingHost: c.WIFI_MONITOR_PING_HOST,
    pingCount: c.WIFI_MONITOR_PING_COUNT,
    speedIntervalMs: c.WIFI_MONITOR_SPEED_INTERVAL_MINUTES * 60 * 1000,
    speedBytes: c.WIFI_MONITOR_SPEED_BYTES,
    interfaceName: c.WIFI_MONITOR_INTERFACE,
    queueFile: c.WIFI_MONITOR_QUEUE_FILE ?? defaultQueueFile,
  };
}
