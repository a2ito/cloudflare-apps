import { describe, expect, it } from "vitest";
import { isDate, today } from "./date";

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
