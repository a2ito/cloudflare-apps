/**
 * 購入場所に添える URL。
 *
 * 買う先は実店舗の地図とは限らず、通販サイトやワイナリーのページも入る。
 * ただし貼られた文字列をそのままリンクにすると `javascript:` を踏ませられるため、
 * 形の分かる https の URL だけを通す。
 */

export const SHOP_URL_EXAMPLE = "https://example.com/wine/...";

/**
 * 受け取れる URL なら正規化して返し、そうでなければ null。
 * 空文字も null（「未入力」は呼び出し側で分ける）。
 */
export function normalizeShopUrl(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  // http は中身を書き換えられうるので受けない
  if (url.protocol !== "https:") return null;
  // user:pass@ を付けた URL は、表示されるホストと実際の飛び先が食い違って見える
  if (url.username !== "" || url.password !== "") return null;
  // ホスト名の形になっていないもの（https://localhost など）は弾く
  if (!url.hostname.includes(".")) return null;
  return url.toString();
}

/** 画面に出すときの短い表記（ホスト名だけ） */
export function shopUrlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
