import { homedir } from "node:os";
import { join } from "node:path";
import { createState, runOnce, type AgentDeps } from "./agent";
import { collectWifi, measureDownload, measurePing } from "./collect";
import { parseConfig } from "./config";
import { acquireLock, appendToQueue, loadQueue, saveQueue } from "./queue";
import { createSender } from "./sender";

/**
 * wifi-monitor のエージェント。launchd / systemd から常駐で起動される。
 * 設定は環境変数から読む（agent/README.md）。
 */

function defaultQueueFile(platform: NodeJS.Platform): string {
  if (platform === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      "wifi-monitor",
      "queue.jsonl",
    );
  }
  const stateHome =
    process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");
  return join(stateHome, "wifi-monitor", "queue.jsonl");
}

function log(message: string): void {
  console.log(`${new Date().toISOString()} ${message}`);
}

/**
 * 止められるまで待つ。止める指示が来たら、タイマーを消してすぐ抜ける
 * （タイマーが残っていると、それが鳴るまでプロセスが終わらない）。
 */
function createStopper(): {
  stopped: () => boolean;
  stop: () => void;
  sleep: (ms: number) => Promise<void>;
} {
  let stopping = false;
  let pending: { timer: NodeJS.Timeout; resolve: () => void } | undefined;
  return {
    stopped: () => stopping,
    stop: () => {
      stopping = true;
      if (pending) {
        clearTimeout(pending.timer);
        pending.resolve();
        pending = undefined;
      }
    },
    sleep: (ms) =>
      stopping
        ? Promise.resolve()
        : new Promise((resolve) => {
            const timer = setTimeout(() => {
              pending = undefined;
              resolve();
            }, ms);
            pending = { timer, resolve };
          }),
  };
}

async function main(): Promise<void> {
  const config = parseConfig(process.env, defaultQueueFile(process.platform));
  const release = await acquireLock(config.queueFile);
  const stopper = createStopper();
  process.on("SIGTERM", stopper.stop);
  process.on("SIGINT", stopper.stop);

  try {
    const deps: AgentDeps = {
      now: () => new Date(),
      monotonic: () => performance.now(),
      collectWifi: () => collectWifi(process.platform, config.interfaceName),
      measurePing: () => measurePing(config.pingHost, config.pingCount),
      measureDownload: () => measureDownload(config.speedBytes, fetch),
      appendToQueue: (sample) => appendToQueue(config.queueFile, sample),
      saveQueue: (samples) => saveQueue(config.queueFile, samples),
      send: createSender({ url: config.url, token: config.token, fetch }),
      log,
    };

    let state = createState(await loadQueue(config.queueFile));
    log(
      `起動しました（送信先 ${config.url}、間隔 ${config.intervalMs / 1000} 秒、キュー ${config.queueFile}、未送信 ${state.queue.length} 件）`,
    );

    while (!stopper.stopped()) {
      const started = performance.now();
      try {
        const next = await runOnce(state, deps, {
          speedIntervalMs: config.speedIntervalMs,
        });
        if (next.unauthorized && !state.unauthorized) {
          log(
            "トークンが受け付けられないため送信を止めました。計測は貯め続けます",
          );
        }
        state = next;
      } catch (error: unknown) {
        // キューのファイルが書けないなど。落とさずに次の回でやり直す（launchd / systemd の再起動の嵐を避ける）
        log(
          `計測に失敗しました: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
        );
      }
      // 計測にかかった時間を差し引いて、間隔をそろえる。単調な時計で測る（壁時計が戻っても待ちが伸びない）
      await stopper.sleep(
        Math.max(0, config.intervalMs - (performance.now() - started)),
      );
    }
    log("止めました");
  } finally {
    await release();
  }
}

main().catch((error: unknown) => {
  log(
    `起動できませんでした: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
