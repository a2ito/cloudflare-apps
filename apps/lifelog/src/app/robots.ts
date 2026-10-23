import type { MetadataRoute } from "next";

/**
 * 検索避け。
 *
 * ログインした人しか中身を見られないため、検索結果に出す意味がない。
 * 全てのクローラに「全部たどらないで」と返す。AI のクローラもこれで止まる。
 *
 * 許可（allow）は書かない。Cloudflare の Managed robots.txt のように
 * 「User-agent: * / Allow: /」が別に足されると、RFC 9309 では許可が優先される。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
