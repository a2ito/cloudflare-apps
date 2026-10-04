"use client";

import { useState } from "react";
import { CURRENCY_LIST } from "@/lib/currency";

// グループ作成フォームの通貨欄。精算通貨を選ぶと、残りの通貨を外貨として選べる。
export function CurrencyFields() {
  const [base, setBase] = useState("JPY");

  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor="currency" className="text-sm font-medium">
          精算通貨
        </label>
        <select
          id="currency"
          name="currency"
          value={base}
          onChange={(e) => setBase(e.target.value)}
          className="w-full rounded-lg border border-black/10 px-3 py-2.5 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        >
          {CURRENCY_LIST.map((c) => (
            <option key={c.code} value={c.code}>
              {c.symbol} {c.label} ({c.code})
            </option>
          ))}
        </select>
        <p className="text-xs text-black/50">精算はこの通貨で行います。</p>
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">ほかに使う通貨（任意）</span>
        <div className="flex flex-wrap gap-1.5">
          {CURRENCY_LIST.filter((c) => c.code !== base).map((c) => (
            <label
              key={c.code}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm cursor-pointer has-checked:border-emerald-500 has-checked:bg-emerald-100"
            >
              <input
                type="checkbox"
                name="currencies"
                value={c.code}
                className="accent-emerald-500"
              />
              {c.symbol} {c.code}
            </label>
          ))}
        </div>
        <p className="text-xs text-black/50">
          選んだ通貨は最新の為替レートを自動で取得します。あとから追加・変更もできます。
        </p>
      </div>
    </>
  );
}
