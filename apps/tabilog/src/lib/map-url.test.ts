import { describe, expect, it } from "vitest";
import { normalizeMapUrl } from "./map-url";

describe("normalizeMapUrl", () => {
  it.each([
    ["共有の短縮 URL", "https://maps.app.goo.gl/AbCdEf123"],
    ["旧い短縮 URL", "https://goo.gl/maps/AbCdEf123"],
    [
      "場所のページ",
      "https://www.google.com/maps/place/%E9%BC%8E%E6%B3%B0%E8%B1%90/@25.03,121.56,17z",
    ],
    ["国別ドメイン", "https://www.google.co.jp/maps/place/Tokyo"],
    ["maps サブドメイン", "https://maps.google.com/?q=25.03,121.56"],
  ])("%s は受け取る", (_name, url) => {
    expect(normalizeMapUrl(url)).toBe(url);
  });

  it("前後の空白は落とす", () => {
    expect(normalizeMapUrl("  https://maps.app.goo.gl/AbCdEf123  ")).toBe(
      "https://maps.app.goo.gl/AbCdEf123",
    );
  });

  it.each([
    ["空文字", ""],
    ["空白だけ", "   "],
    ["URL でない", "鼎泰豐 本店"],
    // リンクにすると踏ませられる
    ["javascript:", "javascript:alert(1)"],
    ["http", "http://www.google.com/maps/place/Tokyo"],
    ["Google でないホスト", "https://example.com/maps/place/Tokyo"],
    // google.com を含むだけの別ドメイン
    ["Google に見せかけたホスト", "https://google.com.example.com/maps"],
    ["地図以外の Google のページ", "https://www.google.com/search?q=maps"],
    ["地図以外の短縮 URL", "https://goo.gl/AbCdEf123"],
  ])("%s は受け取らない", (_name, url) => {
    expect(normalizeMapUrl(url)).toBeNull();
  });
});
