"use client";

import { useEffect, useState } from "react";

/**
 * 画面のどこかで起きた JavaScript のエラーを、その場で見せる。
 *
 * ボタンを押しても何も起きない・白い画面になる、といった不具合は
 * 原因が端末の中で消えてしまい、サーバのログにも残らない。
 * 報告してもらえるよう、内容と時刻を画面に出す。
 */
type Caught = { message: string; at: string };

export function ErrorBanner() {
  const [caught, setCaught] = useState<Caught | null>(null);

  useEffect(() => {
    const record = (message: string) => {
      setCaught({
        message: message.slice(0, 300),
        at: new Date().toLocaleString("ja-JP"),
      });
    };

    function onError(event: ErrorEvent) {
      // 画像の読み込み失敗など、JavaScript 以外の失敗は拾わない
      if (!event.error && !event.message) return;
      record(event.message || String(event.error));
    }
    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason as { message?: string } | string | undefined;
      record(
        typeof reason === "string"
          ? reason
          : (reason?.message ?? "原因不明のエラー"),
      );
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (!caught) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-red-300 bg-red-50 p-3 text-xs text-red-800 shadow-lg dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            エラーが起きました（画面が反応しない場合は再読み込みしてください）
          </p>
          <p className="break-all">{caught.message}</p>
          <p className="text-red-700/70 dark:text-red-300/70">{caught.at}</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-md border border-red-300 px-2 py-1 font-medium dark:border-red-700"
        >
          再読み込み
        </button>
        <button
          type="button"
          onClick={() => setCaught(null)}
          aria-label="閉じる"
          className="shrink-0 rounded-md border border-red-300 px-2 py-1 font-medium dark:border-red-700"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
