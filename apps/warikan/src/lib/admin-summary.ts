import { convertToBase } from "./exchange";

// 管理画面のグループ一覧の 1 行。金額は精算通貨の最小単位
export interface GroupSummary {
  id: string;
  name: string;
  currency: string;
  createdAt: Date;
  memberCount: number;
  expenseCount: number;
  total: number;
  // レートが無く合計に入れられなかった立替の件数
  unconvertedCount: number;
  // 最後に立替を記録した日時。立替が無ければ null
  lastExpenseAt: Date | null;
}

interface GroupRow {
  id: string;
  name: string;
  currency: string;
  createdAt: Date;
}

interface ExpenseRow {
  groupId: string;
  amount: number;
  currency: string;
  createdAt: Date;
}

interface RateRow {
  groupId: string;
  currency: string;
  rate: string | null;
}

// 全グループの行をまとめて受け取り、グループごとに集計する。
// グループごとにクエリを投げると件数ぶん D1 を往復するので、まとめて読んでここで分ける
export function summarizeGroups(
  groups: GroupRow[],
  members: { groupId: string }[],
  expenses: ExpenseRow[],
  rates: RateRow[],
): GroupSummary[] {
  const memberCount = new Map<string, number>();
  for (const m of members) {
    memberCount.set(m.groupId, (memberCount.get(m.groupId) ?? 0) + 1);
  }

  const rateByKey = new Map(
    rates.map((r) => [`${r.groupId}:${r.currency}`, r.rate]),
  );
  const expensesByGroup = new Map<string, ExpenseRow[]>();
  for (const e of expenses) {
    const arr = expensesByGroup.get(e.groupId) ?? [];
    arr.push(e);
    expensesByGroup.set(e.groupId, arr);
  }

  return groups
    .map((g) => {
      const list = expensesByGroup.get(g.id) ?? [];
      let total = 0;
      let unconvertedCount = 0;
      let lastExpenseAt: Date | null = null;
      for (const e of list) {
        if (e.currency === g.currency) {
          total += e.amount;
        } else {
          const rate = rateByKey.get(`${g.id}:${e.currency}`);
          if (rate) total += convertToBase(e.amount, e.currency, g.currency, rate);
          else unconvertedCount += 1;
        }
        if (!lastExpenseAt || e.createdAt > lastExpenseAt) lastExpenseAt = e.createdAt;
      }
      return {
        id: g.id,
        name: g.name,
        currency: g.currency,
        createdAt: g.createdAt,
        memberCount: memberCount.get(g.id) ?? 0,
        expenseCount: list.length,
        total,
        unconvertedCount,
        lastExpenseAt,
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

const dateTimeFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// Workers の既定のタイムゾーンは UTC なので、日本時間に固定して出す
export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}
