"use client";

import { useState, useTransition } from "react";
import { CURRENCY_LIST, getCurrency } from "@/lib/currency";

interface MemberView {
  id: string;
  name: string;
}

interface ExpenseView {
  id: string;
  payerId: string;
  amount: number;
  currency: string;
  amountLabel: string;
  baseAmountLabel: string | null;
  description: string;
  participantIds: string[];
}

type Action = (formData: FormData) => Promise<void>;

export function ExpenseSection({
  members,
  baseCurrency,
  rates,
  expenses,
  memberNames,
  addAction,
  updateAction,
  removeAction,
}: {
  members: MemberView[];
  baseCurrency: string;
  rates: Record<string, string>;
  expenses: ExpenseView[];
  memberNames: Record<string, string>;
  addAction: Action;
  updateAction: Action;
  removeAction: Action;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const canAdd = members.length >= 1;

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-black/5 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">立替</h2>
        {canAdd && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-sm rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-3 py-1.5 transition-colors"
          >
            ＋ 立替を追加
          </button>
        )}
      </div>

      {!canAdd && (
        <p className="text-sm text-black/40">
          立替を記録するには先にメンバーを追加してください。
        </p>
      )}

      {adding && (
        <div className="mb-4">
          <ExpenseForm
            members={members}
            baseCurrency={baseCurrency}
            rates={rates}
            action={addAction}
            onDone={() => setAdding(false)}
            submitLabel="記録する"
          />
        </div>
      )}

      {expenses.length === 0 ? (
        canAdd && !adding ? (
          <p className="text-sm text-black/40">まだ立替がありません。</p>
        ) : null
      ) : (
        <ul className="space-y-2">
          {expenses.map((e) =>
            editingId === e.id ? (
              <li key={e.id}>
                <ExpenseForm
                  members={members}
                  baseCurrency={baseCurrency}
                  rates={rates}
                  action={updateAction}
                  expense={e}
                  onDone={() => setEditingId(null)}
                  submitLabel="更新する"
                />
              </li>
            ) : (
              <li
                key={e.id}
                className="rounded-lg border border-black/5 px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {e.description || "（内容なし）"}
                    </div>
                    <div className="text-xs text-black/50 truncate">
                      {memberNames[e.payerId] ?? "?"} が立替 ・{" "}
                      {e.participantIds
                        .map((id) => memberNames[id] ?? "?")
                        .join(", ")}{" "}
                      で割り勘
                    </div>
                  </div>
                  <div className="ml-auto text-right shrink-0">
                    <div className="font-bold">{e.amountLabel}</div>
                    {e.baseAmountLabel && (
                      <div className="text-xs text-black/50">
                        {e.baseAmountLabel}
                      </div>
                    )}
                    <div className="flex gap-2 justify-end mt-0.5">
                      <button
                        type="button"
                        onClick={() => setEditingId(e.id)}
                        className="text-xs text-black/40 hover:text-emerald-600"
                      >
                        編集
                      </button>
                      <DeleteExpenseButton
                        expenseId={e.id}
                        removeAction={removeAction}
                      />
                    </div>
                  </div>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function DeleteExpenseButton({
  expenseId,
  removeAction,
}: {
  expenseId: string;
  removeAction: Action;
}) {
  const [isPending, startTransition] = useTransition();
  function handle() {
    if (!confirm("この立替を削除しますか？")) return;
    const fd = new FormData();
    fd.set("expenseId", expenseId);
    startTransition(() => removeAction(fd));
  }
  return (
    <button
      type="button"
      onClick={handle}
      disabled={isPending}
      className="text-xs text-black/40 hover:text-rose-500 disabled:opacity-50"
    >
      削除
    </button>
  );
}

function ExpenseForm({
  members,
  baseCurrency,
  rates,
  action,
  expense,
  onDone,
  submitLabel,
}: {
  members: MemberView[];
  baseCurrency: string;
  rates: Record<string, string>;
  action: Action;
  expense?: ExpenseView;
  onDone: () => void;
  submitLabel: string;
}) {
  const [currency, setCurrency] = useState(expense?.currency ?? baseCurrency);
  const [rate, setRate] = useState(rates[currency] ?? "");
  const info = getCurrency(currency);
  const base = getCurrency(baseCurrency);
  const isForeign = currency !== baseCurrency;
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const defaultAmount = expense
    ? (expense.amount / 10 ** info.decimals).toFixed(info.decimals)
    : "";

  function changeCurrency(next: string) {
    setCurrency(next);
    setRate(rates[next] ?? "");
  }
  const defaultParticipants = new Set(
    expense ? expense.participantIds : members.map((m) => m.id),
  );

  function handle(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await action(formData);
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  }

  return (
    <form
      action={handle}
      className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-3"
    >
      {expense && <input type="hidden" name="expenseId" value={expense.id} />}

      <div className="space-y-1">
        <label className="text-xs font-medium text-black/60">内容</label>
        <input
          name="description"
          type="text"
          maxLength={100}
          defaultValue={expense?.description ?? ""}
          placeholder="例: 夕食、レンタカー"
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-black/60">支払った人</label>
        <select
          name="payerId"
          required
          defaultValue={expense?.payerId ?? members[0]?.id ?? ""}
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-black/60">通貨</label>
          <select
            name="currency"
            value={currency}
            onChange={(e) => changeCurrency(e.target.value)}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500"
          >
            {CURRENCY_LIST.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-black/60">
            金額 ({info.symbol})
          </label>
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            required
            defaultValue={defaultAmount}
            placeholder={info.decimals > 0 ? "0.00" : "0"}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {isForeign && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-black/60">
            為替レート（1 {info.code} = ? {base.code}）
          </label>
          <input
            name="rate"
            type="text"
            inputMode="decimal"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="例: 150.25"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500"
          />
          <p className="text-xs text-black/40">
            このグループの {info.code} の立替はすべてこのレートで {base.code}{" "}
            に換算して精算します。
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-black/60">
          割り勘の対象（均等割り）
        </label>
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <label
              key={m.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm cursor-pointer has-checked:border-emerald-500 has-checked:bg-emerald-100"
            >
              <input
                type="checkbox"
                name="participantIds"
                value={m.id}
                defaultChecked={defaultParticipants.has(m.id)}
                className="accent-emerald-500"
              />
              {m.name}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-rose-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 transition-colors disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg bg-black/5 hover:bg-black/10 text-sm px-4 py-2 transition-colors"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
