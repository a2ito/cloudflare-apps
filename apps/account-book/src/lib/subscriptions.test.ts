import { describe, expect, it } from "vitest";
import { dueDates, todayInJst, type BillingRule } from "./subscriptions";

const monthly = (
  billingDay: number,
  startDate = "2020-01-01",
): BillingRule => ({
  cycle: "monthly",
  billingDay,
  billingMonth: null,
  startDate,
});

const yearly = (
  billingMonth: number,
  billingDay: number,
  startDate = "2020-01-01",
): BillingRule => ({ cycle: "yearly", billingDay, billingMonth, startDate });

describe("dueDates", () => {
  it("月額は前月と今月の請求日のうち今日までのものを返す", () => {
    expect(dueDates(monthly(10), "2026-10-25")).toEqual([
      "2026-09-10",
      "2026-10-10",
    ]);
    expect(dueDates(monthly(28), "2026-10-25")).toEqual(["2026-09-28"]);
  });

  it("請求日当日は計上対象に含める", () => {
    expect(dueDates(monthly(25), "2026-10-25")).toContain("2026-10-25");
  });

  it("月末を超える請求日は月末に寄せる", () => {
    expect(dueDates(monthly(31), "2026-03-01")).toEqual(["2026-02-28"]);
    expect(dueDates(monthly(31), "2028-03-01")).toEqual(["2028-02-29"]);
  });

  it("1 月は前年 12 月を前月として扱う", () => {
    expect(dueDates(monthly(20), "2026-01-05")).toEqual(["2025-12-20"]);
  });

  it("開始日より前の請求日は計上しない", () => {
    expect(dueDates(monthly(10, "2026-10-01"), "2026-10-25")).toEqual([
      "2026-10-10",
    ]);
    expect(dueDates(monthly(10, "2026-10-11"), "2026-10-25")).toEqual([]);
  });

  it("年額は前年と今年の請求日のうち今日までのものを返す", () => {
    expect(dueDates(yearly(4, 1), "2026-10-25")).toEqual([
      "2025-04-01",
      "2026-04-01",
    ]);
    expect(dueDates(yearly(12, 1), "2026-10-25")).toEqual(["2025-12-01"]);
    expect(dueDates(yearly(2, 29), "2026-03-01")).toEqual([
      "2025-02-28",
      "2026-02-28",
    ]);
  });
});

describe("todayInJst", () => {
  it("UTC 15 時以降は日本時間の翌日になる", () => {
    expect(todayInJst(new Date("2026-10-24T14:59:59Z"))).toBe("2026-10-24");
    expect(todayInJst(new Date("2026-10-24T15:00:00Z"))).toBe("2026-10-25");
  });
});
