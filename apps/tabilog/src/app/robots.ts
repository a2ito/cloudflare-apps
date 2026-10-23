import type { MetadataRoute } from "next";

/**
 * 検索避け。
 *
 * 許可したメールアドレスでログインした人しか中身を見られないため、
 * 検索結果に出す意味がない。クローラが毎日 /robots.txt を取りに来て
 * 404 になっていたので、明示的に「全部たどらないで」と返す。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
