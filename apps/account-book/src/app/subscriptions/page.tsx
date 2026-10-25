"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Category = {
  id: number;
  name: string;
};

type Cycle = "monthly" | "yearly";

type Subscription = {
  id: number;
  name: string;
  amount: number;
  categoryId: string;
  categoryName: string | null;
  cycle: Cycle;
  billingDay: number;
  billingMonth: number | null;
  startDate: string;
  active: boolean;
};

type Form = {
  name: string;
  amount: string;
  categoryId: string;
  cycle: Cycle;
  billingDay: string;
  billingMonth: string;
  startDate: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): Form => ({
  name: "",
  amount: "",
  categoryId: "",
  cycle: "monthly",
  billingDay: String(new Date().getDate()),
  billingMonth: String(new Date().getMonth() + 1),
  startDate: today(),
});

const toForm = (s: Subscription): Form => ({
  name: s.name,
  amount: String(s.amount),
  categoryId: s.categoryId,
  cycle: s.cycle,
  billingDay: String(s.billingDay),
  billingMonth: String(s.billingMonth ?? 1),
  startDate: s.startDate,
});

const toBody = (form: Form, active: boolean) => ({
  name: form.name,
  amount: Number(form.amount),
  categoryId: form.categoryId,
  cycle: form.cycle,
  billingDay: Number(form.billingDay),
  billingMonth: form.cycle === "yearly" ? Number(form.billingMonth) : null,
  startDate: form.startDate,
  active,
});

const ERROR_MESSAGES: Record<string, string> = {
  "name-required": "名前を入力してください",
  "invalid-amount": "金額は 1 円以上の整数で入力してください",
  "category-required": "カテゴリを選んでください",
  "invalid-billing-day": "請求日は 1〜31 で入力してください",
  "invalid-billing-month": "請求月を選んでください",
  "invalid-start-date": "開始日を入力してください",
};

const describeCycle = (s: Subscription) =>
  s.cycle === "monthly"
    ? `毎月 ${s.billingDay} 日`
    : `毎年 ${s.billingMonth} 月 ${s.billingDay} 日`;

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-800";
const labelClass = "mb-1 block text-sm text-gray-600 dark:text-gray-400";

export default function SubscriptionsPage() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/subscriptions");
    if (!res.ok) {
      setError(`一覧を読み込めませんでした（${res.status}）`);
      return;
    }
    setItems((await res.json()) as Subscription[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d as Category[]));
  }, [load]);

  // 有効なものを月あたりに換算した合計（年額は 12 で割る）
  const monthlyTotal = useMemo(
    () =>
      items
        .filter((s) => s.active)
        .reduce(
          (sum, s) => sum + (s.cycle === "monthly" ? s.amount : s.amount / 12),
          0,
        ),
    [items],
  );

  const update = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const request = async (url: string, init: RequestInit) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(
          ERROR_MESSAGES[body.error ?? ""] ??
            `保存できませんでした（${body.error ?? res.status}）`,
        );
        return false;
      }
      await load();
      return true;
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const ok = editing
      ? await request(`/api/subscriptions/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(toBody(form, editing.active)),
        })
      : await request("/api/subscriptions", {
          method: "POST",
          body: JSON.stringify(toBody(form, true)),
        });
    if (ok) cancelEdit();
  };

  const toggleActive = (s: Subscription) =>
    request(`/api/subscriptions/${s.id}`, {
      method: "PATCH",
      body: JSON.stringify(toBody(toForm(s), !s.active)),
    });

  const remove = async (s: Subscription) => {
    if (!confirm(`「${s.name}」を削除しますか？計上済みの支出は残ります。`))
      return;
    await request(`/api/subscriptions/${s.id}`, { method: "DELETE" });
    if (editing?.id === s.id) cancelEdit();
  };

  const startEdit = (s: Subscription) => {
    setEditing(s);
    setForm(toForm(s));
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm(emptyForm());
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          🔁 サブスク
        </h1>
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← 家計簿へ
        </Link>
      </div>

      {/* 一覧 */}
      <section className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          月あたりの合計（有効なもの）
        </p>
        <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">
          ¥{Math.round(monthlyTotal).toLocaleString()}
        </p>

        {items.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">まだ登録されていません</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-200 dark:divide-gray-700">
            {items.map((s) => (
              <li key={s.id} className={`py-3 ${s.active ? "" : "opacity-50"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.name}</span>
                  <span className="tabular-nums">
                    ¥{s.amount.toLocaleString()}
                    <span className="ml-1 text-xs text-gray-500">
                      /{s.cycle === "monthly" ? "月" : "年"}
                    </span>
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    {describeCycle(s)}・{s.categoryName ?? "カテゴリなし"}
                    {!s.active && "・停止中"}
                  </span>
                  <span className="flex gap-3">
                    <button
                      onClick={() => startEdit(s)}
                      className="text-blue-600 dark:text-blue-400"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => toggleActive(s)}
                      disabled={saving}
                      className="text-gray-600 dark:text-gray-300"
                    >
                      {s.active ? "停止" : "再開"}
                    </button>
                    <button
                      onClick={() => remove(s)}
                      disabled={saving}
                      className="text-red-600"
                    >
                      削除
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 登録・編集フォーム */}
      <section className="space-y-4 rounded-xl bg-white dark:bg-gray-800 p-4 shadow">
        <h2 className="font-semibold">
          {editing ? `「${editing.name}」を編集` : "サブスクを登録"}
        </h2>

        <div>
          <label className={labelClass}>名前</label>
          <input
            className={inputClass}
            placeholder="Netflix"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>金額</label>
          <input
            type="number"
            inputMode="numeric"
            className={inputClass}
            placeholder="1490"
            value={form.amount}
            onChange={(e) => update("amount", e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>カテゴリ</label>
          <select
            className={inputClass}
            value={form.categoryId}
            onChange={(e) => update("categoryId", e.target.value)}
          >
            <option value="">選択してください</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>周期</label>
          <div className="flex gap-4 text-sm">
            {(["monthly", "yearly"] as const).map((c) => (
              <label key={c} className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={form.cycle === c}
                  onChange={() => update("cycle", c)}
                />
                {c === "monthly" ? "月額" : "年額"}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {form.cycle === "yearly" && (
            <div className="flex-1">
              <label className={labelClass}>請求月</label>
              <select
                className={inputClass}
                value={form.billingMonth}
                onChange={(e) => update("billingMonth", e.target.value)}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}月
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex-1">
            <label className={labelClass}>請求日</label>
            <select
              className={inputClass}
              value={form.billingDay}
              onChange={(e) => update("billingDay", e.target.value)}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}日
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          ※ 月末より後の日は月末に計上します（31 日払いの 2 月は 28/29 日）
        </p>

        <div>
          <label className={labelClass}>開始日</label>
          <input
            type="date"
            className={inputClass}
            value={form.startDate}
            onChange={(e) => update("startDate", e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">
            ※ 開始日以降の請求日に、毎日 0 時過ぎに支出として自動で記録します
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-full bg-blue-600 py-3 font-semibold text-white disabled:opacity-50"
          >
            {editing ? "更新" : "登録"}
          </button>
          {editing && (
            <button
              onClick={cancelEdit}
              className="rounded-full bg-gray-200 px-5 dark:bg-gray-700"
            >
              やめる
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
