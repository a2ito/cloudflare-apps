import { CURRENCY_LIST } from "@/lib/currency";
import { createGroup } from "./actions";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="text-center space-y-3 pt-6">
        <h1 className="text-3xl font-bold tracking-tight">
          みんなで割り勘、かんたんに。
        </h1>
        <p className="text-black/60 text-sm leading-relaxed">
          ログイン不要。旅行やイベントの立替を記録すると、
          <br className="hidden sm:block" />
          誰が誰にいくら払えばいいかを最小回数で自動計算します。
        </p>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-black/5 p-6">
        <h2 className="font-semibold mb-4">グループを作成</h2>
        <form action={createGroup} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              グループ名
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={100}
              placeholder="例: 沖縄旅行2026"
              className="w-full rounded-lg border border-black/10 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="currency" className="text-sm font-medium">
              精算通貨
            </label>
            <select
              id="currency"
              name="currency"
              defaultValue="JPY"
              className="w-full rounded-lg border border-black/10 px-3 py-2.5 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              {CURRENCY_LIST.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.label} ({c.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-black/50">
              精算はこの通貨で行います。立替はほかの通貨でも記録でき、為替レートで換算します。
            </p>
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 transition-colors"
          >
            作成する
          </button>
        </form>
      </section>

      <section className="grid gap-3 sm:grid-cols-3 text-center">
        {[
          { t: "1. メンバー登録", d: "参加者の名前を追加" },
          { t: "2. 立替を記録", d: "誰が何にいくら払ったか" },
          { t: "3. 精算", d: "最小回数の送金を表示" },
        ].map((s) => (
          <div
            key={s.t}
            className="rounded-xl bg-white border border-black/5 p-4"
          >
            <div className="font-semibold text-sm">{s.t}</div>
            <div className="text-xs text-black/50 mt-1">{s.d}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
