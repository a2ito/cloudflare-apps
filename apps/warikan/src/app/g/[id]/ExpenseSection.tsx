"use client";

import { useState, useTransition } from "react";
import { formatAmount, getCurrency, parseAmountToMinor } from "@/lib/currency";
import { splitByWeight, type SettlementParticipant } from "@/lib/settlement";
import {
  DEFAULT_WEIGHT,
  MAX_WEIGHT,
  MIN_WEIGHT,
  WEIGHT_SCALE,
  formatWeight,
  parseWeight,
} from "@/lib/weight";

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
  participants: SettlementParticipant[];
}

/** 割り勘対象の表示。傾斜をつけた立替だけ、1 倍でない人に倍率を添える */
function participantsLabel(
  participants: SettlementParticipant[],
  memberNames: Record<string, string>,
): string {
  const weighted = participants.some((p) => p.weight !== DEFAULT_WEIGHT);
  return participants
    .map((p) => {
      const name = memberNames[p.memberId] ?? "?";
      return weighted && p.weight !== DEFAULT_WEIGHT
        ? `${name} ×${formatWeight(p.weight)}`
        : name;
    })
    .join(", ");
}

type Action = (formData: FormData) => Promise<void>;

export function ExpenseSection({
  members,
  currencies,
  expenses,
  memberNames,
  addAction,
  updateAction,
  removeAction,
}: {
  members: MemberView[];
  currencies: string[];
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
            currencies={currencies}
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
                  currencies={currencies}
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
                      {participantsLabel(e.participants, memberNames)}{" "}
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

/**
 * 傾斜をつけたときの各人の負担額（入力中のプレビュー）。
 * 金額か倍率のどれかがまだ不正なら null。精算は精算通貨に換算してから分けるので、
 * 外貨の立替では精算額と 1 単位ずれることがある
 */
function previewShares(
  amountInput: string,
  currency: string,
  weightInputs: string[],
): string[] | null {
  const amount = parseAmountToMinor(amountInput, currency);
  const weights = weightInputs.map(parseWeight);
  if (amount === null || !weights.every((w): w is number => w !== null)) {
    return null;
  }
  return splitByWeight(amount, weights).map((share) =>
    formatAmount(share, currency),
  );
}

function ExpenseForm({
  members,
  currencies,
  action,
  expense,
  onDone,
  submitLabel,
}: {
  members: MemberView[];
  // 選べる通貨。先頭が精算通貨
  currencies: string[];
  action: Action;
  expense?: ExpenseView;
  onDone: () => void;
  submitLabel: string;
}) {
  const [currency, setCurrency] = useState(expense?.currency ?? currencies[0]);
  const info = getCurrency(currency);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [amount, setAmount] = useState(
    expense
      ? (expense.amount / 10 ** info.decimals).toFixed(info.decimals)
      : "",
  );

  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        expense
          ? expense.participants.map((p) => p.memberId)
          : members.map((m) => m.id),
      ),
  );
  // 傾斜はオプション。すでに傾斜のある立替を編集するときだけ最初から開く
  const [weighted, setWeighted] = useState(
    expense?.participants.some((p) => p.weight !== DEFAULT_WEIGHT) ?? false,
  );
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      members.map((m) => {
        const saved = expense?.participants.find((p) => p.memberId === m.id);
        return [m.id, formatWeight(saved?.weight ?? DEFAULT_WEIGHT)];
      }),
    ),
  );

  function toggleParticipant(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const selectedMembers = members.filter((m) => selected.has(m.id));
  const shares = weighted
    ? previewShares(
        amount,
        currency,
        selectedMembers.map((m) => weights[m.id] ?? ""),
      )
    : null;

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

      <div
        className={
          currencies.length > 1
            ? "grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2"
            : ""
        }
      >
        {currencies.length > 1 ? (
          <div className="space-y-1">
            <label className="text-xs font-medium text-black/60">通貨</label>
            <select
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="currency" value={currency} />
        )}
        <div className="space-y-1">
          <label className="text-xs font-medium text-black/60">
            金額 ({info.symbol})
          </label>
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={info.decimals > 0 ? "0.00" : "0"}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-black/60">
          割り勘の対象
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
                checked={selected.has(m.id)}
                onChange={(e) => toggleParticipant(m.id, e.target.checked)}
                className="accent-emerald-500"
              />
              {m.name}
            </label>
          ))}
        </div>

        <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="weighted"
            checked={weighted}
            onChange={(e) => setWeighted(e.target.checked)}
            className="accent-emerald-500"
          />
          傾斜をつける
        </label>

        {weighted && selectedMembers.length > 0 && (
          <div className="rounded-lg bg-white border border-black/5 p-2.5 space-y-1.5">
            <p className="text-xs text-black/50">
              倍率の比で負担を分けます（{formatWeight(MIN_WEIGHT)}〜
              {formatWeight(MAX_WEIGHT)}、0.5 刻み）。例: 2 の人は 1 の人の 2 倍。
            </p>
            {selectedMembers.map((m, i) => (
              <div key={m.id} className="flex items-center gap-2 text-sm">
                <label htmlFor={`weight-${m.id}`} className="flex-1 truncate">
                  {m.name}
                </label>
                <span className="text-black/40">×</span>
                <input
                  id={`weight-${m.id}`}
                  name={`weight:${m.id}`}
                  type="number"
                  inputMode="decimal"
                  min={MIN_WEIGHT / WEIGHT_SCALE}
                  max={MAX_WEIGHT / WEIGHT_SCALE}
                  step={0.5}
                  required
                  value={weights[m.id] ?? ""}
                  onChange={(e) =>
                    setWeights((prev) => ({ ...prev, [m.id]: e.target.value }))
                  }
                  className="w-20 rounded-lg border border-black/10 px-2 py-1 text-right bg-white outline-none focus:border-emerald-500"
                />
                <span className="w-24 text-right text-black/60 tabular-nums">
                  {shares ? shares[i] : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
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
