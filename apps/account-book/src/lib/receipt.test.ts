import { describe, expect, it } from "vitest";
import { MAX_RECEIPT_BYTES, receiptKey, validateReceipt } from "./receipt";

describe("validateReceipt", () => {
  it("jpeg・png・webp を受け付ける", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validateReceipt({ type, size: 1000 })).toEqual({
        ok: true,
        contentType: type,
      });
    }
  });

  it("画像以外や HEIC は弾く", () => {
    for (const type of ["application/pdf", "image/heic", ""]) {
      expect(validateReceipt({ type, size: 1000 })).toEqual({
        ok: false,
        error: "unsupported-type",
      });
    }
  });

  it("空のファイルは弾く", () => {
    expect(validateReceipt({ type: "image/jpeg", size: 0 })).toEqual({
      ok: false,
      error: "empty",
    });
  });

  it("上限ちょうどは通し、超えたら弾く", () => {
    expect(
      validateReceipt({ type: "image/jpeg", size: MAX_RECEIPT_BYTES }).ok,
    ).toBe(true);
    expect(
      validateReceipt({ type: "image/jpeg", size: MAX_RECEIPT_BYTES + 1 }),
    ).toEqual({ ok: false, error: "too-large" });
  });

  it("toString のようなプロトタイプのキーを形式として扱わない", () => {
    expect(validateReceipt({ type: "toString", size: 1 }).ok).toBe(false);
  });
});

describe("receiptKey", () => {
  it("グループ・明細・UUID と形式に合う拡張子でキーを作る", () => {
    expect(receiptKey("g1", 42, "image/webp", "uuid-1")).toBe(
      "receipts/g1/42/uuid-1.webp",
    );
    expect(receiptKey("g1", 42, "image/jpeg", "uuid-2")).toBe(
      "receipts/g1/42/uuid-2.jpg",
    );
  });
});
