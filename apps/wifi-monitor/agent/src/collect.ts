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
 *
 * 計測できなかった理由（コマンドが無い・時間切れ）は issues で返す。値が null になる理由を
 * 「つながっていない」と区別できるよう、呼び出し側がログに出す。
 */

export type Measured<T> = { value: T; issues: string[] };

type ExecResult = {
  stdout: string;
  /** missing: コマンドが無い、timeout: 打ち切った、failed: 0 以外で終わった */
  problem: "missing" | "timeout" | "failed" | null;
};

/**
 * コマンドを実行して標準出力を返す。終了コードが 0 でなくても標準出力は返す
 * （ping はパケットが失われると 0 以外で終わるが、要約は出している）。
 */
function run(
  file: string,
  args: readonly string[],
  options: { timeoutMs: number; killSignal?: NodeJS.Signals },
): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      {
        timeout: options.timeoutMs,
        killSignal: options.killSignal ?? "SIGTERM",
        maxBuffer: 4 * 1024 * 1024,
      },
      (error, stdout) => {
        const err = error as
          (NodeJS.ErrnoException & { killed?: boolean }) | null;
        resolve({
          stdout: String(stdout ?? ""),
          problem: !err
            ? null
            : err.code === "ENOENT"
              ? "missing"
              : err.killed
                ? "timeout"
                : "failed",
        });
      },
    );
  });
}

function issueOf(command: string, result: ExecResult): string[] {
  if (result.problem === "missing") {
    return [`${command} が見つかりません（PATH を確かめてください）`];
  }
  if (result.problem === "timeout")
    return [`${command} が時間内に終わりませんでした`];
  return [];
}

async function collectMacWifi(
  interfaceName: string | undefined,
): Promise<Measured<WifiInfo>> {
  const profiler = await run(
    "system_profiler",
    ["SPAirPortDataType", "-json"],
    {
      timeoutMs: 30_000,
    },
  );
  const issues = issueOf("system_profiler", profiler);
  let info: (WifiInfo & { interface: string }) | null = null;
  try {
    info = parseSystemProfiler(JSON.parse(profiler.stdout));
  } catch {
    info = null;
  }
  if (!info) return { value: NO_WIFI, issues };
  if (info.ssid) return { value: info, issues };
  // system_profiler は位置情報の権限が無いと SSID を伏せる。ipconfig の詳細表示が有効なら取れる
  const summary = await run(
    "ipconfig",
    ["getsummary", interfaceName ?? info.interface],
    { timeoutMs: 10_000 },
  );
  return {
    value: { ...info, ssid: parseIpconfigSsid(summary.stdout) },
    issues: [...issues, ...issueOf("ipconfig", summary)],
  };
}

async function collectLinuxWifi(
  interfaceName: string | undefined,
): Promise<Measured<WifiInfo>> {
  const issues: string[] = [];
  let candidates: string[];
  if (interfaceName) {
    candidates = [interfaceName];
  } else {
    const dev = await run("iw", ["dev"], { timeoutMs: 10_000 });
    issues.push(...issueOf("iw", dev));
    candidates = parseIwDev(dev.stdout);
  }
  for (const itf of candidates) {
    const result = await run("iw", ["dev", itf, "link"], { timeoutMs: 10_000 });
    issues.push(...issueOf("iw", result));
    const link = parseIwLink(result.stdout);
    if (link) return { value: link, issues };
  }
  return { value: NO_WIFI, issues };
}

/** Wi-Fi の情報。取れない OS やつながっていないときは全部 null */
export async function collectWifi(
  platform: NodeJS.Platform,
  interfaceName: string | undefined,
): Promise<Measured<WifiInfo>> {
  if (platform === "darwin") return collectMacWifi(interfaceName);
  if (platform === "linux") return collectLinuxWifi(interfaceName);
  return {
    value: NO_WIFI,
    issues: [`${platform} では Wi-Fi の情報を取れません`],
  };
}

/**
 * 要約が無いときの読み替え。ping が動いたのに要約を出さずに 0 以外で終わったのは、
 * Linux の「connect: Network is unreachable」のように送ることすらできなかった場合なので、
 * 損失 100 として扱う（macOS はこの場合も 100% loss の要約を出す。OS で結果を揃える）。
 */
export function interpretPing(
  stdout: string,
  problem: ExecResult["problem"],
): PingResult {
  const parsed = parsePing(stdout);
  if (parsed.packetLossPct === null && problem === "failed") {
    return { latencyMs: null, packetLossPct: 100 };
  }
  return parsed;
}

export async function measurePing(
  host: string,
  count: number,
): Promise<Measured<PingResult>> {
  // 全部失われると最後の 1 発のあと最大 10 秒ほど待つので、その分の余裕を見る。
  // 打ち切るときは SIGINT を送る（ping は SIGINT で止められると要約を出す）
  const result = await run("ping", ["-c", String(count), "-q", host], {
    timeoutMs: (count + 15) * 1000,
    killSignal: "SIGINT",
  });
  const issues = result.problem === "missing" ? issueOf("ping", result) : [];
  return {
    value:
      result.problem === "missing"
        ? { latencyMs: null, packetLossPct: null }
        : interpretPing(result.stdout, result.problem),
    issues,
  };
}

/**
 * ダウンロード速度（Mbps）。Cloudflare の速度計測用の URL から決まった量を落として計る。
 *
 * 時間は最初のデータを受け取ってから数える。接続（DNS・TCP・TLS）と最初の応答までの時間を含めると、
 * 速い回線では転送そのものより長くなり、半分以下の値になってしまうため。その分、最初のかたまりの量は数えない。
 * 失敗したら null（回線が切れているときは遅延・損失の方で分かる）。
 */
export async function measureDownload(
  bytes: number,
  fetchImpl: typeof fetch,
  now: () => number = () => performance.now(),
): Promise<number | null> {
  try {
    const res = await fetchImpl(
      `https://speed.cloudflare.com/__down?bytes=${bytes}`,
      { signal: AbortSignal.timeout(120_000) },
    );
    if (!res.ok || !res.body) return null;
    let started: number | null = null;
    let received = 0;
    for await (const chunk of res.body) {
      if (started === null) {
        started = now();
        continue;
      }
      received += chunk.byteLength;
    }
    if (started === null || received === 0) return null;
    const seconds = (now() - started) / 1000;
    if (seconds <= 0) return null;
    return Math.round(((received * 8) / seconds / 1_000_000) * 10) / 10;
  } catch {
    return null;
  }
}
