import { describe, expect, it } from "vitest";
import { convertToBase, parseRate } from "./exchange";

describe("parseRate", () => {
  it("正規化したレート文字列を返す", () => {
    expect(parseRate("150.25")).toBe("150.25");
    expect(parseRate(" 1,234.500 ")).toBe("1234.5");
    expect(parseRate("007")).toBe("7");
    expect(parseRate("0.0068")).toBe("0.0068");
  });

  it("0 以下や不正な入力は null", () => {
    expect(parseRate("")).toBeNull();
    expect(parseRate("0")).toBeNull();
    expect(parseRate("0.000")).toBeNull();
    expect(parseRate("-1")).toBeNull();
    expect(parseRate("1e3")).toBeNull();
    expect(parseRate("abc")).toBeNull();
  });

  it("桁数の上限を超えると null", () => {
    expect(parseRate("0.12345678901")).toBeNull();
    expect(parseRate("1234567890")).toBeNull();
  });
});

describe("convertToBase", () => {
  it("同じ通貨ならそのまま", () => {
    expect(convertToBase(1234, "JPY", "JPY", "1")).toBe(1234);
  });

  it("USD(2 桁) を JPY(0 桁) に換算する", () => {
    // 12.34 USD × 150.25 = 1854.085 → 1854 円
    expect(convertToBase(1234, "USD", "JPY", "150.25")).toBe(1854);
  });

  it("JPY(0 桁) を USD(2 桁) に換算する", () => {
    // 1000 円 × 0.0068 = 6.80 USD
    expect(convertToBase(1000, "JPY", "USD", "0.0068")).toBe(680);
  });

  it("KRW を JPY に換算する", () => {
    // 15000 KRW × 0.11 = 1650 円
    expect(convertToBase(15000, "KRW", "JPY", "0.11")).toBe(1650);
  });

  it("端数は四捨五入する", () => {
    // 1.00 USD × 100.5 = 100.5 → 101
    expect(convertToBase(100, "USD", "JPY", "100.5")).toBe(101);
    // 1.00 USD × 100.4 = 100.4 → 100
    expect(convertToBase(100, "USD", "JPY", "100.4")).toBe(100);
  });

  it("大きな額でも浮動小数の誤差が出ない", () => {
    // 99,999,999.99 USD × 123.456789
    expect(convertToBase(9_999_999_999, "USD", "JPY", "123.456789")).toBe(
      12_345_678_899,
    );
  });
});
