import { describe, expect, it } from "vitest";
import { isDate, jstDateOf, today } from "./date";

describe("isDate", () => {
  it("YYYY-MM-DD の実在する日付だけ通す", () => {
    expect(isDate("2026-10-12")).toBe(true);
    expect(isDate("2024-02-29")).toBe(true);
    expect(isDate("2026-02-30")).toBe(false);
    expect(isDate("2026/10/12")).toBe(false);
    expect(isDate("")).toBe(false);
  });
});

describe("today", () => {
  it("日本時間の日付を返す（UTC では前日でも）", () => {
    expect(today(new Date("2026-10-11T15:30:00Z"))).toBe("2026-10-12");
    expect(today(new Date("2026-10-11T14:59:00Z"))).toBe("2026-10-11");
  });
});

describe("jstDateOf", () => {
  it("UTC の日時を日本時間の日付にする", () => {
    expect(jstDateOf("2026-10-12 14:59:59")).toBe("2026-10-12");
    expect(jstDateOf("2026-10-12 15:00:00")).toBe("2026-10-13");
  });

  it("読めない値はそのまま返す", () => {
    expect(jstDateOf("不明")).toBe("不明");
  });
});
