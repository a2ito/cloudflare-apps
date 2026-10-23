"use client";

import { useEffect } from "react";

/**
 * 画面の描画に失敗したときの受け皿。
 *
 * 今までは失敗しても白い画面や素の 404 が出るだけで、何が起きたのか
 * 分からず、利用者にも打つ手が無かった。原因を画面に出して、
 * その場でやり直せるようにする。
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // ブラウザの開発者ツールからも追えるように残す
    console.error("[たびログ] 画面の表示に失敗しました", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950"
    >
      <h1 className="text-xl font-bold text-red-800 dark:text-red-200">
        うまく表示できませんでした
      </h1>
      <p className="text-sm text-red-700 dark:text-red-300">
        通信が途切れたか、アプリの新しい版が出た直後かもしれません。やり直すと直ることがあります。
      </p>

      {/* 報告してもらうときの手がかり。サーバのログと突き合わせるのに使う */}
      <dl className="space-y-1 rounded-md border border-red-200 bg-white p-3 text-xs dark:border-red-900 dark:bg-zinc-950">
        <div className="flex gap-2">
          <dt className="shrink-0 text-zinc-500">内容</dt>
          <dd className="break-all">{error.message || "（詳細なし）"}</dd>
        </div>
        {error.digest && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-zinc-500">識別子</dt>
            <dd className="break-all font-mono">{error.digest}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="shrink-0 text-zinc-500">時刻</dt>
          <dd>{new Date().toLocaleString("ja-JP")}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
        >
          やり直す
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          再読み込み
        </button>
      </div>
    </div>
  );
}
