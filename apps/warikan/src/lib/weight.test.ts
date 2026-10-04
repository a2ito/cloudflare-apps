import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHT, formatWeight, parseWeight } from "./weight";

describe("parseWeight", () => {
  it("倍率を 10 倍した整数にする", () => {
    expect(parseWeight("1")).toBe(DEFAULT_WEIGHT);
    expect(parseWeight("1.5")).toBe(15);
    expect(parseWeight(" 2.0 ")).toBe(20);
    expect(parseWeight("0.5")).toBe(5);
    expect(parseWeight("10")).toBe(100);
  });

  it("0.5 刻みでなければ null", () => {
    expect(parseWeight("1.2")).toBeNull();
    expect(parseWeight("1.25")).toBeNull();
  });

  it("範囲外や数でない入力は null", () => {
    expect(parseWeight("0")).toBeNull();
    expect(parseWeight("10.5")).toBeNull();
    expect(parseWeight("-1")).toBeNull();
    expect(parseWeight("")).toBeNull();
    expect(parseWeight("abc")).toBeNull();
    expect(parseWeight("1e1")).toBeNull();
  });
});

describe("formatWeight", () => {
  it("倍率の表示に戻す", () => {
    expect(formatWeight(10)).toBe("1");
    expect(formatWeight(15)).toBe("1.5");
    expect(formatWeight(5)).toBe("0.5");
    expect(formatWeight(100)).toBe("10");
  });

  it("parseWeight と往復できる", () => {
    for (const w of [5, 10, 15, 20, 35, 100]) {
      expect(parseWeight(formatWeight(w))).toBe(w);
    }
  });
});
