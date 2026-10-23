/**
 * 記録に添える Google マップの URL。
 *
 * 貼られた文字列をそのままリンクにすると `javascript:` を踏ませられたり、
 * 地図のふりをした別サイトへ飛ばせたりするため、
 * https で、かつ Google マップのホストのものだけを通す。
 */

/** 共有メニューから出てくる短縮 URL のホスト */
const SHORT_LINK_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);

/** google.com / google.co.jp / maps.google.com など。国別ドメインが多いので形で見る */
const GOOGLE_HOST = /^(?:[a-z0-9-]+\.)?google(?:\.[a-z]{2,3}){1,2}$/;

/** 入力欄に出す案内と、弾いたときのエラー文で同じ例を使う */
export const MAP_URL_EXAMPLE = "https://maps.app.goo.gl/...";

/**
 * 受け取れる URL なら正規化して返し、そうでなければ null。
 * 空文字も null（「未入力」は呼び出し側で分ける）。
 */
export function normalizeMapUrl(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  if (SHORT_LINK_HOSTS.has(host)) {
    // goo.gl は地図以外の短縮にも使われていたので、/maps 配下だけ受ける
    if (host === "goo.gl" && !url.pathname.startsWith("/maps/")) return null;
    return url.toString();
  }
  if (!GOOGLE_HOST.test(host)) return null;
  // google.com/search のような地図以外のページは受けない
  if (!url.pathname.startsWith("/maps") && !host.startsWith("maps."))
    return null;
  return url.toString();
}
