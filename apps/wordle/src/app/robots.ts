import type { MetadataRoute } from "next";

/**
 * AI の学習・回答用のクローラ。
 *
 * Cloudflare の Managed robots.txt が拒否していたものと同じ一覧にしている。
 * あちらはゾーン全体に一律で入るため、検索避けをしているアプリ（sakelog など）と
 * 食い違った。アプリごとに書けるよう、こちらに移した。
 *
 * robots.txt はお願いでしかない。実際の遮断は Cloudflare の Block AI bots が行う。
 */
const AI_CRAWLERS = [
  "Amazonbot",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "ClaudeBot",
  "Diffbot",
  "Google-Extended",
  "GPTBot",
  "omgili",
  "anthropic-ai",
  "Claude-Web",
];

/** 検索エンジンには公開したまま、AI のクローラだけを断る */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_CRAWLERS, disallow: "/" },
      { userAgent: "*", allow: "/" },
    ],
  };
}
