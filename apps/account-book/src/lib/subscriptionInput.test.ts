import { describe, expect, it } from "vitest";
import { parseSubscriptionInput } from "./subscriptionInput";

const valid = {
  name: " Netflix ",
  amount: 1490,
  categoryId: 3,
  cycle: "monthly",
  billingDay: 15,
  billingMonth: 4,
  startDate: "2026-10-01",
};

describe("parseSubscriptionInput", () => {
  it("名前を trim し、月額では請求月を捨てる", () => {
    expect(parseSubscriptionInput(valid)).toEqual({
      ok: true,
      value: {
        name: "Netflix",
        amount: 1490,
        categoryId: "3",
        cycle: "monthly",
        billingDay: 15,
        billingMonth: null,
        startDate: "2026-10-01",
        active: true,
      },
    });
  });

  it("年額は請求月が必須", () => {
    expect(
      parseSubscriptionInput({ ...valid, cycle: "yearly", billingMonth: null }),
    ).toEqual({ ok: false, error: "invalid-billing-month" });
    const parsed = parseSubscriptionInput({ ...valid, cycle: "yearly" });
    expect(parsed.ok && parsed.value.billingMonth).toBe(4);
  });

  it("active: false を受け付ける", () => {
    const parsed = parseSubscriptionInput({ ...valid, active: false });
    expect(parsed.ok && parsed.value.active).toBe(false);
  });

  it.each([
    [{ name: "  " }, "name-required"],
    [{ amount: 0 }, "invalid-amount"],
    [{ amount: 1.5 }, "invalid-amount"],
    [{ categoryId: "" }, "category-required"],
    [{ cycle: "weekly" }, "invalid-cycle"],
    [{ billingDay: 32 }, "invalid-billing-day"],
    [{ startDate: "2026/10/01" }, "invalid-start-date"],
  ])("不正な値 %o は %s", (patch, error) => {
    expect(parseSubscriptionInput({ ...valid, ...patch })).toEqual({
      ok: false,
      error,
    });
  });

  it("オブジェクト以外は拒否する", () => {
    expect(parseSubscriptionInput(null)).toEqual({
      ok: false,
      error: "invalid-body",
    });
  });
});
