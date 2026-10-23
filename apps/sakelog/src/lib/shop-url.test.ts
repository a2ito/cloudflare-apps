import { describe, expect, it } from "vitest";
import { normalizeShopUrl, shopUrlHost } from "./shop-url";

describe("normalizeShopUrl", () => {
  it("https の URL を通す", () => {
    expect(normalizeShopUrl("https://www.enoteca.co.jp/item/123")).toBe(
      "https://www.enoteca.co.jp/item/123",
    );
  });

  it("未入力は null（呼び出し側で「入力なし」と区別する）", () => {
    expect(normalizeShopUrl("")).toBeNull();
    expect(normalizeShopUrl("   ")).toBeNull();
  });

  it("スクリプトを踏ませる URL を弾く", () => {
    expect(normalizeShopUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeShopUrl("data:text/html,<script>")).toBeNull();
  });

  it("http は受けない（中身を書き換えられうる）", () => {
    expect(normalizeShopUrl("http://example.com/wine")).toBeNull();
  });

  it("表示されるホストと飛び先が食い違う URL を弾く", () => {
    expect(normalizeShopUrl("https://example.com@evil.example/x")).not.toBe(
      "https://example.com@evil.example/x",
    );
    expect(normalizeShopUrl("https://user:pass@evil.example/x")).toBeNull();
  });

  it("URL の形でないものは null", () => {
    expect(normalizeShopUrl("エノテカ銀座店")).toBeNull();
    expect(normalizeShopUrl("https://localhost/x")).toBeNull();
  });
});

describe("shopUrlHost", () => {
  it("画面には www を落としたホスト名だけ出す", () => {
    expect(shopUrlHost("https://www.enoteca.co.jp/item/123")).toBe(
      "enoteca.co.jp",
    );
  });
  it("読めない値はそのまま返す", () => {
    expect(shopUrlHost("なにか")).toBe("なにか");
  });
});
