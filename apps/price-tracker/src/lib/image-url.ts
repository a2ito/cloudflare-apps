// クライアントコンポーネントからも読む。env（cloudflare:workers）に触れる images.ts とは分ける。
// cloudflare:workers はクライアントのビルドで解決できず、images.ts ごと読むとビルドが落ちる。

/**
 * 画像の配信 URL。R2 のカスタムドメインを直に指すので Worker を経由しない。
 *
 * 以前は Worker 上の Route Handler (/api/images) で認証を確かめてから R2 を読んで
 * 返していた。ただしトップページが商品数ぶんのサムネイルを並べるため、一覧を 1 回
 * 開くだけで商品数ぶんの Worker が起動し、その全てで Auth.js のセッション復号が
 * 走っていた。CDN から直に返せば Worker は 1 度も起動しない。
 *
 * 引き換えに、画像は URL を知っていれば認証なしで取得できる。キーが UUID v4 で
 * 推測できないことに依存している。バケットの一覧は公開されないため列挙もできない。
 * 商品名や価格は D1 にあり、今まで通り認証の内側にある。
 *
 * 基底 URL はクライアントコンポーネントからも呼ぶため NEXT_PUBLIC_ 付きで、
 * next build 時に値が埋め込まれる。未設定なら /api/images へ落とす。
 *
 * 手元では画像が Miniflare のローカル R2 に入り、カスタムドメインからは取れないため
 * この経路が要る。本番でも、基底 URL を渡し忘れたときは CPU 削減が効かないだけで
 * 画像は出る。以前はここで例外を投げていたが、全ページが動的レンダリングのため
 * ビルドは通ってしまい、本番のトップページが 500 になった。落とすより遅い方がよい。
 */
export function imageUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_IMAGES_BASE_URL;
  if (base) return `${base.replace(/\/+$/, "")}/${key}`;
  // 基底 URL が無ければ Worker 経由に落とす。CPU は減らないが画像は出る。
  return `/api/images/${key}`;
}
