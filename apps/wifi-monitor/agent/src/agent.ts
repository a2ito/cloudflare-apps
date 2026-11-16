import { sampleSchema, type SampleInput } from "../../src/lib/sample-schema";
import type { PingResult, WifiInfo } from "./parse";
import { capQueue, MAX_QUEUED_SAMPLES } from "./queue";
import { flushQueue, type Send } from "./sender";

/** 1 回分の処理が使う外の世界。テストでは差し替える */
export type AgentDeps = {
  now: () => Date;
  collectWifi: () => Promise<WifiInfo>;
  measurePing: () => Promise<PingResult>;
  /** 計らない回は呼ばれない */
  measureDownload: () => Promise<number | null>;
  loadQueue: () => Promise<SampleInput[]>;
  saveQueue: (samples: readonly SampleInput[]) => Promise<void>;
  send: Send;
  log: (message: string) => void;
};

export type AgentState = {
  /** 最後にダウンロード速度を計った時刻（ms）。まだなら null */
  lastSpeedAt: number | null;
  /** 401 が返ったら true。再起動するまで送らない（計測は貯め続ける） */
  unauthorized: boolean;
};

export const initialState: AgentState = {
  lastSpeedAt: null,
  unauthorized: false,
};

/**
 * 1 回分: 計測してキューに積み、貯まっている分を送る。新しい状態を返す。
 *
 * 計測は送る前にキューへ書く（送信中に落ちても失わないように）。
 * 送信が失敗しても例外にはせず、次の回に送り直す。
 */
export async function runOnce(
  state: AgentState,
  deps: AgentDeps,
  options: { speedIntervalMs: number },
): Promise<AgentState> {
  const measuredAt = deps.now();
  const speedDue =
    options.speedIntervalMs > 0 &&
    (state.lastSpeedAt === null ||
      measuredAt.getTime() - state.lastSpeedAt >= options.speedIntervalMs);

  const [wifi, ping, downloadMbps] = await Promise.all([
    deps.collectWifi(),
    deps.measurePing(),
    speedDue ? deps.measureDownload() : Promise.resolve(null),
  ]);

  const parsed = sampleSchema.safeParse({
    measuredAt: measuredAt.toISOString(),
    ...wifi,
    ...ping,
    downloadMbps,
  });
  const queue = await deps.loadQueue();
  if (parsed.success) {
    queue.push(parsed.data);
  } else {
    // 機器が範囲外の値を返したなど。この 1 件だけ捨てる（キュー全体を巻き込まない）
    deps.log(
      `計測値が受信 API の形に合わないので捨てました: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  let remaining = capQueue(queue, MAX_QUEUED_SAMPLES);
  if (remaining.length < queue.length) {
    deps.log(
      `貯めている計測が上限を超えたので、古い ${queue.length - remaining.length} 件を捨てました`,
    );
  }
  // 先に保存してから送る。送信中に落ちても今回の計測は残る
  await deps.saveQueue(remaining);

  let unauthorized = state.unauthorized;
  if (!unauthorized && remaining.length > 0) {
    const result = await flushQueue(remaining, deps.send);
    result.logs.forEach(deps.log);
    unauthorized = result.unauthorized;
    if (result.remaining.length !== remaining.length) {
      remaining = result.remaining;
      await deps.saveQueue(remaining);
    }
  }

  return {
    lastSpeedAt: speedDue ? measuredAt.getTime() : state.lastSpeedAt,
    unauthorized,
  };
}
