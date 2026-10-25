import type { SubscriptionCycle } from "./subscriptions";

export type SubscriptionInput = {
  name: string;
  amount: number;
  categoryId: string;
  cycle: SubscriptionCycle;
  billingDay: number;
  billingMonth: number | null;
  startDate: string;
  active: boolean;
};

export type ParseResult =
  { ok: true; value: SubscriptionInput } | { ok: false; error: string };

const isIntIn = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

const isDate = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v));

/** 登録・更新のリクエスト本文を検証して、保存できる形にそろえる */
export const parseSubscriptionInput = (body: unknown): ParseResult => {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "invalid-body" };
  }
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (name === "") return { ok: false, error: "name-required" };

  if (!isIntIn(b.amount, 1, Number.MAX_SAFE_INTEGER)) {
    return { ok: false, error: "invalid-amount" };
  }

  const categoryId =
    typeof b.categoryId === "number" || typeof b.categoryId === "string"
      ? String(b.categoryId)
      : "";
  if (categoryId === "") return { ok: false, error: "category-required" };

  if (b.cycle !== "monthly" && b.cycle !== "yearly") {
    return { ok: false, error: "invalid-cycle" };
  }

  if (!isIntIn(b.billingDay, 1, 31)) {
    return { ok: false, error: "invalid-billing-day" };
  }

  if (b.cycle === "yearly" && !isIntIn(b.billingMonth, 1, 12)) {
    return { ok: false, error: "invalid-billing-month" };
  }

  if (!isDate(b.startDate)) return { ok: false, error: "invalid-start-date" };

  return {
    ok: true,
    value: {
      name,
      amount: b.amount,
      categoryId,
      cycle: b.cycle,
      billingDay: b.billingDay,
      billingMonth: b.cycle === "yearly" ? (b.billingMonth as number) : null,
      startDate: b.startDate,
      active: b.active !== false,
    },
  };
};
