import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatTimestamp,
  isDate,
  maxYear,
  today,
  toDate,
} from "./datetime";

describe("isDate", () => {
  it("date 入力の形式を受け付ける", () => {
    expect(isDate("2026-09-23")).toBe(true);
  });
  it("形式違いを弾く", () => {
    expect(isDate("2026/09/23")).toBe(false);
    expect(isDate("2026-09-23T12:30")).toBe(false);
    expect(isDate("")).toBe(false);
  });
  it("存在しない日付を弾く", () => {
    expect(isDate("2026-02-30")).toBe(false);
    expect(isDate("2026-13-01")).toBe(false);
  });
  it("うるう年は受け付ける", () => {
    expect(isDate("2024-02-29")).toBe(true);
    expect(isDate("2026-02-29")).toBe(false);
  });
});

describe("toDate", () => {
  it("時刻が付いていても日付だけに丸める", () => {
    expect(toDate("2026-09-23T12:30")).toBe("2026-09-23");
    expect(toDate(" 2026-09-23 ")).toBe("2026-09-23");
  });
  it("直せないものは null", () => {
    expect(toDate("きのう")).toBeNull();
    expect(toDate("")).toBeNull();
  });
});

describe("formatDate", () => {
  it("先頭の 0 を落として読みやすくする", () => {
    expect(formatDate("2026-09-03")).toBe("2026/9/3");
  });
  it("日付でないものはそのまま返す（画面を壊さない）", () => {
    expect(formatDate("いつか")).toBe("いつか");
  });
});

describe("formatTimestamp", () => {
  it("UTC の ISO 文字列を日本時間で出す", () => {
    expect(formatTimestamp("2026-09-23T12:30:00.000Z")).toBe(
      "2026/09/23 21:30",
    );
  });
  it("読めない値はそのまま返す", () => {
    expect(formatTimestamp("なにか")).toBe("なにか");
  });
});

describe("today", () => {
  it("日本時間の日付を date 入力の形で返す", () => {
    // UTC では前日でも、日本時間では翌日になる時刻で確かめる
    expect(today(new Date("2026-09-23T15:30:00Z"))).toBe("2026-09-24");
  });
});

describe("maxYear", () => {
  it("受け付ける年の上限は今年", () => {
    expect(maxYear(new Date("2026-09-23T00:00:00Z"))).toBe(2026);
  });
});
