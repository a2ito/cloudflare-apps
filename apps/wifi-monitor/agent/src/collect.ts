import { execFile } from "node:child_process";
import {
  NO_WIFI,
  parseIpconfigSsid,
  parseIwDev,
  parseIwLink,
  parsePing,
  parseSystemProfiler,
  type PingResult,
  type WifiInfo,
} from "./parse";

/**
 * 計測の副作用の部分（コマンドの実行と通信）。出力の読み取りは parse.ts。
 */

type ExecResult = { stdout: string; failed: boolean };

/**
 * コマンドを実行して標準出力を返す。終了コードが 0 でなくても標準出力は返す
 * （ping はパケットが失われると 0 以外で終わるが、要約は出している）。
 */
function run(
  file: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => {
        resolve({ stdout: String(stdout ?? ""), failed: error !== null });
      },
    );
  });
}

async function collectMacWifi(
  interfaceName: string | undefined,
): Promise<WifiInfo> {
  const profiler = await run(
    "system_profiler",
    ["SPAirPortDataType", "-json"],
    30_000,
  );
  let info: (WifiInfo & { interface: string }) | null = null;
  try {
    info = parseSystemProfiler(JSON.parse(profiler.stdout));
  } catch {
    info = null;
  }
  if (!info) return NO_WIFI;
  if (info.ssid) return info;
  // system_profiler は位置情報の権限が無いと SSID を伏せる。ipconfig の詳細表示が有効なら取れる
  const summary = await run(
    "ipconfig",
    ["getsummary", interfaceName ?? info.interface],
    10_000,
  );
  return { ...info, ssid: parseIpconfigSsid(summary.stdout) };
}

async function collectLinuxWifi(
  interfaceName: string | undefined,
): Promise<WifiInfo> {
  const candidates = interfaceName
    ? [interfaceName]
    : parseIwDev((await run("iw", ["dev"], 10_000)).stdout);
  for (const itf of candidates) {
    const link = parseIwLink(
      (await run("iw", ["dev", itf, "link"], 10_000)).stdout,
    );
    if (link) return link;
  }
  return NO_WIFI;
}

/** Wi-Fi の情報。取れない OS やつながっていないときは全部 null */
export async function collectWifi(
  platform: NodeJS.Platform,
  interfaceName: string | undefined,
): Promise<WifiInfo> {
  if (platform === "darwin") return collectMacWifi(interfaceName);
  if (platform === "linux") return collectLinuxWifi(interfaceName);
  return NO_WIFI;
}

export async function measurePing(
  host: string,
  count: number,
): Promise<PingResult> {
  // 1 発ごとに最大 1 秒待つとして、少し余裕を見て打ち切る
  const result = await run(
    "ping",
    ["-c", String(count), "-q", host],
    (count + 10) * 1000,
  );
  return parsePing(result.stdout);
}

/**
 * ダウンロード速度（Mbps）。Cloudflare の速度計測用の URL から決まった量を落とし、かかった時間で割る。
 * 失敗したら null（回線が切れているときは遅延・損失の方で分かる）。
 */
export async function measureDownload(
  bytes: number,
  fetchImpl: typeof fetch,
  now: () => number = () => performance.now(),
): Promise<number | null> {
  const started = now();
  try {
    const res = await fetchImpl(
      `https://speed.cloudflare.com/__down?bytes=${bytes}`,
      { signal: AbortSignal.timeout(120_000) },
    );
    if (!res.ok || !res.body) return null;
    let received = 0;
    for await (const chunk of res.body) received += chunk.byteLength;
    const seconds = (now() - started) / 1000;
    if (received === 0 || seconds <= 0) return null;
    return Math.round(((received * 8) / seconds / 1_000_000) * 10) / 10;
  } catch {
    return null;
  }
}
