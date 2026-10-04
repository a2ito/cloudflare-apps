"use client";

import { useState, useTransition } from "react";
import { CURRENCY_LIST, getCurrency } from "@/lib/currency";

interface RateView {
  currency: string;
  rate: string | null;
  rateSource: "auto" | "manual";
  rateDate: string | null;
  expenseCount: number;
}

type Action = (formData: FormData) => Promise<void>;

export function RateSection({
  baseCurrency,
  rates,
  addAction,
  removeAction,
  updateAction,
  refreshAction,
}: {
  baseCurrency: string;
  rates: RateView[];
  addAction: Action;
  removeAction: Action;
  updateAction: Action;
  refreshAction: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const base = getCurrency(baseCurrency);
  const addable = CURRENCY_LIST.filter(
    (c) =>
      c.code !== baseCurrency && !rates.some((r) => r.currency === c.code),
  );

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-black/5 p-5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="font-semibold">通貨と為替レート</h2>
        {rates.length > 0 && (
          <button
            type="button"
            onClick={() => run(refreshAction)}
            disabled={isPending}
            className="text-xs rounded-lg bg-black/5 hover:bg-black/10 px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            {isPending ? "取得中…" : "最新レートに更新"}
          </button>
        )}
      </div>
      <p className="text-xs text-black/50 mb-3">
        精算は {base.code} で行います。外貨の立替はここのレートで換算します。
      </p>

      {rates.length > 0 && (
        <ul className="space-y-2 mb-3">
          {rates.map((r) => (
            <RateRow
              // 保存・再取得の後に最新のレートで入力欄を作り直す
              key={`${r.currency}:${r.rate ?? ""}:${r.rateSource}`}
              baseCurrency={baseCurrency}
              rate={r}
              removeAction={removeAction}
              updateAction={updateAction}
            />
          ))}
        </ul>
      )}

      {addable.length > 0 && (
        <form
          action={(fd) => run(() => addAction(fd))}
          className="flex items-center gap-2"
        >
          <select
            name="currency"
            aria-label="追加する通貨"
            className="min-w-0 flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500"
          >
            {addable.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.label} ({c.code})
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="shrink-0 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 transition-colors disabled:opacity-50"
          >
            通貨を追加
          </button>
        </form>
      )}

      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
    </section>
  );
}

function RateRow({
  baseCurrency,
  rate,
  removeAction,
  updateAction,
}: {
  baseCurrency: string;
  rate: RateView;
  removeAction: Action;
  updateAction: Action;
}) {
  const [value, setValue] = useState(rate.rate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const info = getCurrency(rate.currency);
  const changed = value.trim() !== (rate.rate ?? "");

  function run(action: Action, formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await action(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  }

  function remove() {
    if (!confirm(`${info.code} をこのグループから外しますか？`)) return;
    const fd = new FormData();
    fd.set("currency", rate.currency);
    run(removeAction, fd);
  }

  return (
    <li className="rounded-lg border border-black/5 px-3 py-2.5">
      <form
        action={(fd) => run(updateAction, fd)}
        className="flex items-center gap-2 text-sm"
      >
        <input type="hidden" name="currency" value={rate.currency} />
        <span className="shrink-0 font-medium">1 {info.code} =</span>
        <input
          name="rate"
          type="text"
          inputMode="decimal"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="未設定"
          aria-label={`${info.code} のレート`}
          className="min-w-0 flex-1 rounded-lg border border-black/10 px-3 py-1.5 bg-white outline-none focus:border-emerald-500"
        />
        <span className="shrink-0 text-black/60">{baseCurrency}</span>
        <button
          type="submit"
          disabled={isPending || !changed}
          className="shrink-0 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 transition-colors disabled:opacity-40"
        >
          保存
        </button>
      </form>
      <div className="mt-1 flex items-center gap-2 text-xs text-black/40">
        <span>
          {info.label}・立替 {rate.expenseCount} 件・
          {rate.rate === null ? (
            <span className="text-rose-500">
              レートを取得できませんでした。手で入力してください（この通貨の立替は精算に含まれていません）
            </span>
          ) : rate.rateSource === "auto" ? (
            `自動取得${rate.rateDate ? `（${rate.rateDate} 時点）` : ""}`
          ) : (
            "手入力"
          )}
        </span>
        {rate.expenseCount === 0 && (
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            className="ml-auto shrink-0 hover:text-rose-500 disabled:opacity-50"
          >
            外す
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </li>
  );
}
