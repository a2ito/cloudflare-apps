import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
// Cron の入口（worker.ts）からも wrangler でバンドルされるため相対パスで読む
import { expenses, subscriptions } from "../db/schema";

export type SubscriptionCycle = "monthly" | "yearly";

export type BillingRule = {
  cycle: SubscriptionCycle;
  billingDay: number;
  billingMonth: number | null;
  startDate: string; // yyyy-mm-dd
};

const pad = (n: number) => String(n).padStart(2, "0");

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** 請求日が月末を超える（31 日払いの 2 月など）ときは月末に寄せる */
const billingDate = (year: number, month: number, day: number) =>
  `${year}-${pad(month)}-${pad(Math.min(day, daysInMonth(year, month)))}`;

/** 日本時間の今日を yyyy-mm-dd で返す */
export const todayInJst = (now: Date): string =>
  new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * 今日までに計上すべき請求日を返す。
 * Cron が 1 日止まっても月（年）をまたいで取りこぼさないよう、
 * 今期と前期の請求日を候補にし、開始日から今日までのものに絞る。
 */
export const dueDates = (rule: BillingRule, today: string): string[] => {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));

  const candidates =
    rule.cycle === "monthly"
      ? [
          month === 1
            ? billingDate(year - 1, 12, rule.billingDay)
            : billingDate(year, month - 1, rule.billingDay),
          billingDate(year, month, rule.billingDay),
        ]
      : [year - 1, year].map((y) =>
          billingDate(y, rule.billingMonth ?? 1, rule.billingDay),
        );

  return candidates.filter((d) => d >= rule.startDate && d <= today);
};

/**
 * 有効なサブスクのうち請求日を迎えたものを支出として計上する。
 * (subscription_id, date) の一意制約で、何度呼んでも二重には入らない。
 * groupId を渡すとそのグループだけを対象にする。
 */
export const postDueSubscriptionExpenses = async (
  db: DrizzleD1Database,
  today: string,
  groupId?: string,
): Promise<number> => {
  const conditions = [eq(subscriptions.active, true)];
  if (groupId) conditions.push(eq(subscriptions.groupId, groupId));

  const rows = await db
    .select()
    .from(subscriptions)
    .where(and(...conditions));

  const values = rows.flatMap((sub) =>
    dueDates(sub, today).map((date) => ({
      groupId: sub.groupId,
      amount: sub.amount,
      categoryId: sub.categoryId,
      memo: sub.name,
      date,
      subscriptionId: sub.id,
    })),
  );

  if (values.length === 0) return 0;

  const inserted = await db
    .insert(expenses)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: expenses.id });

  return inserted.length;
};
