import { describe, expect, it } from "vitest";
import {
  formatFuzzyDate,
  isFuzzyDate,
  isLifespanOrdered,
  lifespanLabel,
  pickerStartDate,
} from "./fuzzy-date";

describe("isFuzzyDate", () => {
  it.each(["1950", "1950-04", "1950-04-01", "2028-02-29", "0800"])(
    "%s は通す",
    (v) => expect(isFuzzyDate(v)).toBe(true),
  );
  it.each([
    "",
    "195",
    "1950-4",
    "1950-13",
    "1950-00",
    "1950-02-30",
    "2027-02-29",
    "1950/04/01",
    "0000",
    "0000-01",
    "0000-01-01",
  ])("%s は弾く", (v) => expect(isFuzzyDate(v)).toBe(false));
});

describe("formatFuzzyDate", () => {
  it("分かっている粒度まで出す", () => {
    expect(formatFuzzyDate("1950")).toBe("1950年");
    expect(formatFuzzyDate("1950-04")).toBe("1950年4月");
    expect(formatFuzzyDate("1950-04-01")).toBe("1950年4月1日");
  });
});

describe("isLifespanOrdered", () => {
  it("没年が生年より後なら通す", () => {
    expect(isLifespanOrdered("1950-04-01", "2020-01-01")).toBe(true);
    expect(isLifespanOrdered("1950", "1950")).toBe(true);
  });
  it("没年が生年より前なら弾く", () => {
    expect(isLifespanOrdered("1950-04-01", "1950-03-31")).toBe(false);
    expect(isLifespanOrdered("1950", "1949-12")).toBe(false);
  });
  it("粒度が違うときは分かる範囲で比べる", () => {
    // 1950 年のいつ生まれたか分からないので、1950 年 1 月に亡くなっていても矛盾とは言えない
    expect(isLifespanOrdered("1950", "1950-01-01")).toBe(true);
  });
  it("片方が無ければ通す", () => {
    expect(isLifespanOrdered(null, "2020")).toBe(true);
    expect(isLifespanOrdered("1950", null)).toBe(true);
  });
});

describe("lifespanLabel", () => {
  it("年だけを並べる", () => {
    expect(lifespanLabel("1950-04-01", "2020")).toBe("1950–2020");
    expect(lifespanLabel("1950", null)).toBe("1950–");
    expect(lifespanLabel(null, null)).toBeNull();
  });
});

describe("pickerStartDate", () => {
  it("年月日がそろっていればそのまま使う", () => {
    expect(pickerStartDate(" 1950-04-15 ")).toBe("1950-04-15");
  });
  it("年だけ・年月だけ・読めない値は空にする", () => {
    expect(pickerStartDate("1950")).toBe("");
    expect(pickerStartDate("1950-04")).toBe("");
    expect(pickerStartDate("")).toBe("");
    expect(pickerStartDate("昭和25")).toBe("");
    expect(pickerStartDate("1950-02-30")).toBe("");
  });
});
