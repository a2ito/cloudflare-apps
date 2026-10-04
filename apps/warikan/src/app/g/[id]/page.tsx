import { notFound } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { formatAmount, getCurrency } from "@/lib/currency";
import { convertToBase } from "@/lib/exchange";
import {
  calculateSettlement,
  type SettlementParticipant,
} from "@/lib/settlement";
import {
  addMember,
  removeMember,
  addExpense,
  updateExpense,
  removeExpense,
  addCurrency,
  removeCurrency,
  updateRate,
  refreshGroupRates,
} from "./actions";
import { ShareLink } from "./ShareLink";
import { MemberSection } from "./MemberSection";
import { ExpenseSection } from "./ExpenseSection";
import { RateSection } from "./RateSection";
import { RememberGroup } from "./RememberGroup";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const group = await db.query.groups.findFirst({
    where: eq(schema.groups.id, id),
  });
  if (!group) notFound();

  const members = await db.query.members.findMany({
    where: eq(schema.members.groupId, id),
    orderBy: asc(schema.members.createdAt),
  });

  const expenses = await db.query.expenses.findMany({
    where: eq(schema.expenses.groupId, id),
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
    where: eq(schema.exchangeRates.groupId, id),
  });
  const rateByCurrency = new Map(rates.map((r) => [r.currency, r.rate]));

  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const currency = getCurrency(group.currency);

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

  // client 用に整形した立替リスト
  const expenseView = expenses.map((e) => {
    const baseAmount = baseAmountById.get(e.id);
    return {
      id: e.id,
      payerId: e.payerId,
      amount: e.amount,
      currency: e.currency,
      amountLabel: formatAmount(e.amount, e.currency),
      // 外貨の立替だけ、精算通貨での額を添える
      baseAmountLabel:
        e.currency === group.currency
          ? null
          : baseAmount == null
            ? "レート未設定"
            : `≈ ${formatAmount(baseAmount, group.currency)}`,
      description: e.description,
      participants: participantsByExpense.get(e.id) ?? [],
    };
  });

  // 通貨欄には、グループに登録した外貨を並べる
  const rateView = rates.map((r) => ({
    currency: r.currency,
    rate: r.rate,
    rateSource: r.rateSource,
    rateDate: r.rateDate,
    expenseCount: expenses.filter((e) => e.currency === r.currency).length,
  }));
  // 立替で選べる通貨（精算通貨が先頭）
  const expenseCurrencies = [
    group.currency,
    ...rates.map((r) => r.currency),
  ];

  const memberView = members.map((m) => ({ id: m.id, name: m.name }));

  // 精算結果の内訳。レートが無く精算から外れた立替は、明細にも出さない
  const expenseById = new Map(expenses.map((e) => [e.id, e]));
  const breakdownView = settlement.balances.map((b) => ({
    memberId: b.memberId,
    name: memberName.get(b.memberId) ?? "?",
    paidLabel: formatAmount(b.paid, group.currency),
    owedLabel: formatAmount(b.owed, group.currency),
    net: b.net,
    netLabel:
      (b.net > 0 ? "+" : "") + formatAmount(b.net, group.currency),
    items: settlement.shares
      .filter((s) => s.memberId === b.memberId && s.amount > 0)
      .map((s) => {
        const e = expenseById.get(s.expenseId);
        return {
          expenseId: s.expenseId,
          description: e?.description || "（内容なし）",
          payerName: e ? (memberName.get(e.payerId) ?? "?") : "?",
          amountLabel: formatAmount(s.amount, group.currency),
        };
      }),
  }));

  return (
    <div className="space-y-6">
      <RememberGroup id={group.id} name={group.name} />
      <section className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <span className="shrink-0 text-xs font-medium text-black/50 border border-black/10 rounded-full px-2.5 py-1">
            精算 {currency.symbol} {currency.code}
          </span>
        </div>
        <p className="text-sm text-black/50">
          合計 {formatAmount(settlement.total, group.currency)}・立替{" "}
          {expenses.length} 件・メンバー {members.length} 人
        </p>
      </section>

      <ShareLink />

      <MemberSection
        members={memberView}
        balances={settlement.balances.map((b) => ({
          memberId: b.memberId,
          name: memberName.get(b.memberId) ?? "?",
          net: b.net,
          netLabel: formatAmount(b.net, group.currency),
        }))}
        addAction={addMember.bind(null, id)}
        removeAction={removeMember.bind(null, id)}
      />

      <ExpenseSection
        members={memberView}
        currencies={expenseCurrencies}
        expenses={expenseView}
        memberNames={Object.fromEntries(memberName)}
        addAction={addExpense.bind(null, id)}
        updateAction={updateExpense.bind(null, id)}
        removeAction={removeExpense.bind(null, id)}
      />

      <RateSection
        baseCurrency={group.currency}
        rates={rateView}
        addAction={addCurrency.bind(null, id)}
        removeAction={removeCurrency.bind(null, id)}
        updateAction={updateRate.bind(null, id)}
        refreshAction={refreshGroupRates.bind(null, id)}
      />

      <SettlementSection
        transfers={settlement.transfers.map((t) => ({
          from: memberName.get(t.fromId) ?? "?",
          to: memberName.get(t.toId) ?? "?",
          amountLabel: formatAmount(t.amount, group.currency),
        }))}
        breakdown={breakdownView}
        hasExpenses={expenses.length > 0}
      />
    </div>
  );
}

interface BreakdownView {
  memberId: string;
  name: string;
  paidLabel: string;
  owedLabel: string;
  net: number;
  netLabel: string;
  items: {
    expenseId: string;
    description: string;
    payerName: string;
    amountLabel: string;
  }[];
}

function SettlementSection({
  transfers,
  breakdown,
  hasExpenses,
}: {
  transfers: { from: string; to: string; amountLabel: string }[];
  breakdown: BreakdownView[];
  hasExpenses: boolean;
}) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-black/5 p-5">
      <h2 className="font-semibold mb-3">精算結果</h2>
      {!hasExpenses ? (
        <p className="text-sm text-black/40">立替を記録すると精算結果が表示されます。</p>
      ) : transfers.length === 0 ? (
        <p className="text-sm text-black/60">🎉 精算の必要はありません。</p>
      ) : (
        <ul className="space-y-2">
          {transfers.map((t, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-sm"
            >
              <span className="font-medium">{t.from}</span>
              <span className="text-emerald-600">→</span>
              <span className="font-medium">{t.to}</span>
              <span className="ml-auto font-bold text-emerald-700">
                {t.amountLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
      {hasExpenses && breakdown.length > 0 && (
        <BreakdownTable breakdown={breakdown} />
      )}
    </section>
  );
}

// 送金額の根拠を確かめられるよう、メンバーごとの立替・負担・差引と、
// 負担額がどの立替から来ているかを見せる。開閉は <details> に任せて JS を使わない
function BreakdownTable({ breakdown }: { breakdown: BreakdownView[] }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold mb-2">内訳</h3>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 px-3 pb-1 text-xs text-black/40">
        <span>メンバー</span>
        <span className="w-16 text-right">立替</span>
        <span className="w-16 text-right">負担</span>
        <span className="w-16 text-right">差引</span>
      </div>
      <ul className="space-y-1.5">
        {breakdown.map((b) => (
          <li key={b.memberId}>
            <details className="group rounded-lg border border-black/5">
              <summary className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 items-center px-3 py-2 text-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="font-medium truncate">
                  <span className="inline-block w-3 text-black/30 transition-transform group-open:rotate-90">
                    ▸
                  </span>
                  {b.name}
                </span>
                <span className="w-16 text-right tabular-nums">
                  {b.paidLabel}
                </span>
                <span className="w-16 text-right tabular-nums">
                  {b.owedLabel}
                </span>
                <span
                  className={
                    "w-16 text-right tabular-nums font-medium " +
                    (b.net > 0
                      ? "text-emerald-600"
                      : b.net < 0
                        ? "text-rose-500"
                        : "text-black/40")
                  }
                >
                  {b.netLabel}
                </span>
              </summary>
              {b.items.length === 0 ? (
                <p className="px-3 pb-2 pl-6 text-xs text-black/40">
                  負担する立替はありません。
                </p>
              ) : (
                <ul className="px-3 pb-2 pl-6 space-y-1 text-xs text-black/60">
                  {b.items.map((item) => (
                    <li key={item.expenseId} className="flex gap-2">
                      <span className="truncate">{item.description}</span>
                      <span className="shrink-0 text-black/40">
                        （{item.payerName}が立替）
                      </span>
                      <span className="ml-auto shrink-0 tabular-nums">
                        {item.amountLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
