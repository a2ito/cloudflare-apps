"use client";

import { useState, useTransition } from "react";
import { getCurrency } from "@/lib/currency";

interface RateView {
  currency: string;
  rate: string | null;
  expenseCount: number;
}

type Action = (formData: FormData) => Promise<void>;

export function RateSection({
  baseCurrency,
  rates,
  updateAction,
}: {
  baseCurrency: string;
  rates: RateView[];
  updateAction: Action;
}) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-black/5 p-5">
      <h2 className="font-semibold mb-1">為替レート</h2>
      <p className="text-xs text-black/50 mb-3">
        外貨の立替は、ここのレートで {baseCurrency} に換算して精算します。
      </p>
      <ul className="space-y-2">
        {rates.map((r) => (
          <RateRow
            // 保存後に最新のレートで入力欄を作り直す
            key={`${r.currency}:${r.rate ?? ""}`}
            baseCurrency={baseCurrency}
            rate={r}
            updateAction={updateAction}
          />
        ))}
      </ul>
    </section>
  );
}

function RateRow({
  baseCurrency,
  rate,
  updateAction,
}: {
  baseCurrency: string;
  rate: RateView;
  updateAction: Action;
}) {
  const [value, setValue] = useState(rate.rate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const info = getCurrency(rate.currency);
  const changed = value.trim() !== (rate.rate ?? "");

  function handle(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateAction(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  }

  return (
    <li className="rounded-lg border border-black/5 px-3 py-2.5">
      <form action={handle} className="flex items-center gap-2 text-sm">
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
      <p className="mt-1 text-xs text-black/40">
        {info.label}・立替 {rate.expenseCount} 件
        {rate.rate === null && (
          <span className="text-rose-500">
            {" "}
            ・レートが未設定のため精算に含まれていません
          </span>
        )}
      </p>
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </li>
  );
}
