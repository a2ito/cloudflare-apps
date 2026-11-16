import { homedir } from "node:os";
import { join } from "node:path";
import { initialState, runOnce, type AgentDeps } from "./agent";
import { collectWifi, measureDownload, measurePing } from "./collect";
import { parseConfig } from "./config";
import { loadQueue, saveQueue } from "./queue";
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

async function main(): Promise<void> {
  const config = parseConfig(process.env, defaultQueueFile(process.platform));
  const deps: AgentDeps = {
    now: () => new Date(),
    collectWifi: () => collectWifi(process.platform, config.interfaceName),
    measurePing: () => measurePing(config.pingHost, config.pingCount),
    measureDownload: () => measureDownload(config.speedBytes, fetch),
    loadQueue: () => loadQueue(config.queueFile),
    saveQueue: (samples) => saveQueue(config.queueFile, samples),
    send: createSender({ url: config.url, token: config.token, fetch }),
    log,
  };

  log(
    `起動しました（送信先 ${config.url}、間隔 ${config.intervalMs / 1000} 秒、キュー ${config.queueFile}）`,
  );

  let state = initialState;
  let stopping = false;
  let wake: (() => void) | undefined;
  const stop = () => {
    stopping = true;
    wake?.();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  while (!stopping) {
    const started = Date.now();
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
    // 計測にかかった時間を差し引いて、間隔をそろえる
    const wait = Math.max(0, config.intervalMs - (Date.now() - started));
    await new Promise<void>((resolve) => {
      wake = resolve;
      setTimeout(resolve, wait);
    });
  }
  log("止めました");
}

main().catch((error: unknown) => {
  log(
    `起動できませんでした: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
