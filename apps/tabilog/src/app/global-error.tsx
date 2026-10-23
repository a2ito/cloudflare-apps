"use client";

/**
 * いちばん外側（レイアウト自体）が壊れたときの受け皿。
 *
 * この画面はアプリのレイアウトも全体のスタイルも読み込まれないため、
 * 見た目は素のまま。色は指定せず、端末の設定に任せる。
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          padding: "24px",
          lineHeight: 1.7,
        }}
      >
        <title>エラー | たびログ</title>
        <h1 style={{ fontSize: "20px" }}>アプリを表示できませんでした</h1>
        <p style={{ fontSize: "14px" }}>
          時間をおいてからもう一度お試しください。
        </p>
        <p style={{ fontSize: "12px", wordBreak: "break-all" }}>
          {error.message || "（詳細なし）"}
          {error.digest ? ` / ${error.digest}` : ""}
        </p>
        <button
          type="button"
          onClick={() => retry()}
          style={{ fontSize: "14px", padding: "8px 16px" }}
        >
          やり直す
        </button>
      </body>
    </html>
  );
}
