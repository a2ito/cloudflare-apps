import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { convertToBase } from "@/lib/exchange";
import {
  calculateSettlement,
  type SettlementParticipant,
} from "@/lib/settlement";

// グループ 1 件ぶんの行と精算結果をまとめて読む。公開ページと管理画面で同じ計算を使うため
export async function loadGroupData(groupId: string) {
  const db = getDb();

  const group = await db.query.groups.findFirst({
    where: eq(schema.groups.id, groupId),
  });
  if (!group) return null;

  const members = await db.query.members.findMany({
    where: eq(schema.members.groupId, groupId),
    orderBy: asc(schema.members.createdAt),
  });

  const expenses = await db.query.expenses.findMany({
    where: eq(schema.expenses.groupId, groupId),
    orderBy: desc(schema.expenses.createdAt),
  });

  const expenseIds = expenses.map((e) => e.id);
  const participants = expenseIds.length
    ? await db.query.expenseParticipants.findMany({
        where: inArray(schema.expenseParticipants.expenseId, expenseIds),
      })
    : [];

  const participantsByExpense = new Map<string, SettlementParticipant[]>();
  for (const p of participants) {
    const arr = participantsByExpense.get(p.expenseId) ?? [];
    arr.push({ memberId: p.memberId, weight: p.weight });
    participantsByExpense.set(p.expenseId, arr);
  }

  const rates = await db.query.exchangeRates.findMany({
    where: eq(schema.exchangeRates.groupId, groupId),
  });
  const rateByCurrency = new Map(rates.map((r) => [r.currency, r.rate]));

  // 各立替を精算通貨に換算する。レートが無い外貨の立替は精算から外す。
  const baseAmountById = new Map<string, number | null>();
  for (const e of expenses) {
    const rate = rateByCurrency.get(e.currency);
    baseAmountById.set(
      e.id,
      e.currency === group.currency
        ? e.amount
        : rate
          ? convertToBase(e.amount, e.currency, group.currency, rate)
          : null,
    );
  }

  const settlement = calculateSettlement(
    members.map((m) => ({ id: m.id, name: m.name })),
    expenses.flatMap((e) => {
      const amount = baseAmountById.get(e.id);
      if (amount == null) return [];
      return [
        {
          id: e.id,
          payerId: e.payerId,
          amount,
          participants: participantsByExpense.get(e.id) ?? [],
        },
      ];
    }),
  );

  return {
    group,
    members,
    expenses,
    participantsByExpense,
    rates,
    baseAmountById,
    settlement,
  };
}
