import {
  MAX_SAMPLES_PER_REQUEST,
  type SampleInput,
} from "../../src/lib/sample-schema";

/** 1 回の送信の結果。何をすべきかで分ける */
export type SendOutcome =
  | { kind: "ok" }
  /** 形が違う・大きすぎる。同じものを送り直しても通らない */
  | { kind: "rejected"; status: number; message: string }
  /** トークンが違う。直すまで送っても無駄 */
  | { kind: "unauthorized"; message: string }
  /** 回線が切れている・サーバの一時的な不調。あとで送り直す */
  | { kind: "retry"; message: string };

export type Send = (batch: readonly SampleInput[]) => Promise<SendOutcome>;

export type FlushResult = {
  remaining: SampleInput[];
  sent: number;
  dropped: number;
  /** 401 が返った。設定を直して再起動するまで送らない */
  unauthorized: boolean;
  logs: string[];
};

/**
 * 1 回の flush で送るまとまりの数の上限。5 万件を送り切るまで毎分の計測が止まらないよう、
 * 1 回に送るのは 20 まとまり（6000 件）までにして、残りは次の回に回す。
 */
export const MAX_BATCHES_PER_FLUSH = 20;

/**
 * 貯まった計測を古い順に MAX_SAMPLES_PER_REQUEST 件ずつ送る。
 *
 * - 送れた → キューから外す
 * - 400 / 413 → そのまとまりを捨てて次へ（同じまとまりで延々と止まらないように）
 * - 401 → 止める。キューは残す（トークンを直せば送れる）
 * - 回線断・5xx など → 止める。キューは残し、次の回に送り直す
 */
export async function flushQueue(
  queue: readonly SampleInput[],
  send: Send,
  maxBatches: number = MAX_BATCHES_PER_FLUSH,
): Promise<FlushResult> {
  let remaining = [...queue];
  let sent = 0;
  let dropped = 0;
  const logs: string[] = [];
  for (let i = 0; i < maxBatches && remaining.length > 0; i++) {
    const batch = remaining.slice(0, MAX_SAMPLES_PER_REQUEST);
    const outcome = await send(batch);
    switch (outcome.kind) {
      case "ok":
        sent += batch.length;
        remaining = remaining.slice(batch.length);
        break;
      case "rejected":
        dropped += batch.length;
        remaining = remaining.slice(batch.length);
        logs.push(
          `計測 ${batch.length} 件が受け付けられなかったので捨てました（${outcome.status}）: ${outcome.message}`,
        );
        break;
      case "unauthorized":
        logs.push(
          `トークンが受け付けられません。WIFI_MONITOR_TOKEN を確かめて再起動してください: ${outcome.message}`,
        );
        return { remaining, sent, dropped, unauthorized: true, logs };
      case "retry":
        logs.push(
          `送信できませんでした。${remaining.length} 件を貯めて次の回に送り直します: ${outcome.message}`,
        );
        return { remaining, sent, dropped, unauthorized: false, logs };
    }
  }
  return { remaining, sent, dropped, unauthorized: false, logs };
}

/** 受信 API に送る。応答を SendOutcome に読み替える */
export function createSender(options: {
  url: string;
  token: string;
  fetch: typeof fetch;
  timeoutMs?: number;
}): Send {
  return async (batch) => {
    let res: Response;
    try {
      res = await options.fetch(`${options.url}/api/samples`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ samples: batch }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
      });
    } catch (error: unknown) {
      return {
        kind: "retry",
        message: error instanceof Error ? error.message : String(error),
      };
    }
    if (res.ok) return { kind: "ok" };
    const message = await res.text().catch(() => "");
    if (res.status === 401) return { kind: "unauthorized", message };
    if (res.status === 400 || res.status === 413) {
      return { kind: "rejected", status: res.status, message };
    }
    return { kind: "retry", message: `${res.status} ${message}`.trim() };
  };
}
