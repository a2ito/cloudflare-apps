import { sampleSchema, type SampleInput } from "../../src/lib/sample-schema";
import type { Measured } from "./collect";
import type { PingResult, WifiInfo } from "./parse";
import { capQueue, MAX_QUEUED_SAMPLES } from "./queue";
import { flushQueue, type Send } from "./sender";

/** 1 回分の処理が使う外の世界。テストでは差し替える */
export type AgentDeps = {
  /** 計測時刻に使う壁時計 */
  now: () => Date;
  /** 間隔の判定に使う単調な時計（ms）。NTP で壁時計が戻っても間隔が狂わないように */
  monotonic: () => number;
  collectWifi: () => Promise<Measured<WifiInfo>>;
  measurePing: () => Promise<Measured<PingResult>>;
  /** 計らない回は呼ばれない */
  measureDownload: () => Promise<number | null>;
  appendToQueue: (sample: SampleInput) => Promise<void>;
  saveQueue: (samples: readonly SampleInput[]) => Promise<void>;
  send: Send;
  log: (message: string) => void;
};

export type AgentState = {
  /** 送れていない計測。起動時にファイルから読み、以降はメモリで持つ */
  queue: SampleInput[];
  /** 最後にダウンロード速度を計った時刻（単調な時計の ms）。まだなら null */
  lastSpeedAt: number | null;
  /** 401 が返ったら true。再起動するまで送らない（計測は貯め続ける） */
  unauthorized: boolean;
  /** 前の回の計測の問題（コマンドが無いなど）。変わったときだけログに出す */
  issues: string;
};

export function createState(queue: SampleInput[]): AgentState {
  return { queue, lastSpeedAt: null, unauthorized: false, issues: "" };
}

/**
 * 1 回分: 計測してキューに積み、貯まっている分を送る。新しい状態を返す。
 *
 * 計測は送る前にキューのファイルへ追記する（送信中に落ちても失わないように）。
 * 送信が失敗しても例外にはせず、次の回に送り直す。
 */
export async function runOnce(
  state: AgentState,
  deps: AgentDeps,
  options: { speedIntervalMs: number },
): Promise<AgentState> {
  const measuredAt = deps.now();
  const tick = deps.monotonic();
  const speedDue =
    options.speedIntervalMs > 0 &&
    (state.lastSpeedAt === null ||
      tick - state.lastSpeedAt >= options.speedIntervalMs);

  const [wifi, ping] = await Promise.all([
    deps.collectWifi(),
    deps.measurePing(),
  ]);
  // ダウンロードは ping の後に回す。並べて走らせると、毎時ちょうどに遅延と損失が水増しされる
  const downloadMbps = speedDue ? await deps.measureDownload() : null;

  const issues = [...wifi.issues, ...ping.issues].join(" / ");
  if (issues !== state.issues) {
    deps.log(
      issues === ""
        ? "計測の問題が解消しました"
        : `一部の値を計測できませんでした: ${issues}`,
    );
  }

  const parsed = sampleSchema.safeParse({
    measuredAt: measuredAt.toISOString(),
    ...wifi.value,
    ...ping.value,
    downloadMbps,
  });
  let queue = state.queue;
  if (parsed.success) {
    queue = [...queue, parsed.data];
    await deps.appendToQueue(parsed.data);
  } else {
    // 機器が範囲外の値を返したなど。この 1 件だけ捨てる（キュー全体を巻き込まない）
    deps.log(
      `計測値が受信 API の形に合わないので捨てました: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  const capped = capQueue(queue, MAX_QUEUED_SAMPLES);
  if (capped.length < queue.length) {
    deps.log(
      `貯めている計測が上限を超えたので、古い ${queue.length - capped.length} 件を捨てました`,
    );
    queue = capped;
    await deps.saveQueue(queue);
  }

  let unauthorized = state.unauthorized;
  if (!unauthorized && queue.length > 0) {
    const result = await flushQueue(queue, deps.send);
    result.logs.forEach(deps.log);
    unauthorized = result.unauthorized;
    if (result.remaining.length !== queue.length) {
      queue = result.remaining;
      await deps.saveQueue(queue);
    }
  }

  return {
    queue,
    lastSpeedAt: speedDue ? tick : state.lastSpeedAt,
    unauthorized,
    issues,
  };
}
