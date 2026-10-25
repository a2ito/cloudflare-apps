"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getCurrentMonth, addMonth } from "@/lib/month";

import EditExpenseModal, {
  ExpenseForEdit,
} from "@/components/EditExpenseModal";

const CategoryPieChart = dynamic(
  () => import("@/components/CategoryPieChart"),
  { ssr: false },
);

type Summary = {
  category: string;
  total: number;
};

type Category = {
  id: number;
  name: string;
};

type Expense = {
  id: number;
  amount: number;
  date: string;
  memo: string | null;
  category: string;
  categoryName: string;
  categoryId: number;
  tags?: { id: number; name: string }[];
};

type CategoryDiff = {
  category: string;
  current: number;
  previous: number;
  diff: number;
  rate: number | null;
};

export default function DashboardPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [prevSummary, setPrevSummary] = useState<Summary[]>([]);

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ExpenseForEdit | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const router = useRouter();
  const searchParams = useSearchParams();
  const month = searchParams.get("month") ?? getCurrentMonth();

  useEffect(() => {
    const loadCategories = async () => {
      const res = await fetch("/api/categories");
      const data: Category[] = (await res.json()) as Category[];
      setCategories(data);
    };

    loadCategories();
  }, []);

  //const month = useMemo(() => {
  //  const d = new Date();
  //  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  //}, []);

  const fetchExpenses = async (month: string) => {
    setLoading(true);
    const [expensesRes] = await Promise.all([
      fetch(`/api/expenses?month=${month}`),
    ]);
    const expensesText = await expensesRes.text();
    setExpenses(expensesText ? JSON.parse(expensesText) : []);
    setLoading(false);
  };

  const fetchSummary = async (month: string) => {
    setLoading(true);
    const [summaryRes] = await Promise.all([
      fetch(`/api/expenses/summary?month=${month}`),
    ]);
    const summaryText = await summaryRes.text();
    // memo: 前月データのセットは then 句で実行する
    // setSummary(summaryText ? JSON.parse(summaryText) : []);
    setLoading(false);
    return summaryText ? JSON.parse(summaryText) : [];
  };

  useEffect(() => {
    fetchExpenses(month);
    fetchSummary(month).then(setSummary);
    fetchSummary(addMonth(month, -1)).then(setPrevSummary);
  }, [month]);

  const total = useMemo(() => {
    if (!Array.isArray(expenses)) return 0;
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const prevTotal = useMemo(
    () => prevSummary.reduce((sum, s) => sum + Number(s.total), 0),
    [prevSummary],
  );

  const diff = total - prevTotal;

  const rate = prevTotal === 0 ? null : ((diff / prevTotal) * 100).toFixed(1);
  //console.log(prevSummary, total, prevTotal, diff, rate)

  const deleteExpense = async (id: number) => {
    if (!confirm("この支出を削除しますか？")) return;

    await fetch(`/api/expenses/${id}`, {
      method: "DELETE",
    });

    // mutate(); // 再取得 or state 更新
    //setExpenses((prev) => prev.filter((e) => e.id !== id));
    fetchExpenses(month);
    fetchSummary(month);
  };

  const categoryDiffs: CategoryDiff[] = useMemo(() => {
    const prevMap = new Map(
      prevSummary.map((s) => [s.category, Number(s.total)]),
    );

    return summary.map((s) => {
      const current = Number(s.total);
      const previous = prevMap.get(s.category) ?? 0;
      const diff = current - previous;

      return {
        category: s.category,
        current,
        previous,
        diff,
        rate: previous === 0 ? null : Math.round((diff / previous) * 100),
      };
    });
  }, [summary, prevSummary]);

  useEffect(() => {
    if (!searchParams.get("month")) {
      router.replace(`/?month=${getCurrentMonth()}`);
    }
  }, [searchParams, router]);

  const changeMonth = (diff: number) => {
    router.push(`/?month=${addMonth(month, diff)}`);
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-24">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            家計簿
          </h1>
          <div className="flex gap-3">
            <Link
              href="/subscriptions"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              🔁 サブスク
            </Link>
            <Link
              href="/tags"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              🏷️ タグ管理
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => changeMonth(-1)}
            className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700"
          >
            ◀
          </button>

          <h2 className="text-lg font-semibold">
            {month.replace("-", "年")}月
          </h2>

          <button
            onClick={() => changeMonth(1)}
            className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700"
          >
            ▶
          </button>
        </div>
      </header>

      {/* 合計 */}
      <section className="mb-6 rounded-xl bg-white dark:bg-gray-800 p-4 shadow">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {month.replace("-", "年")}月の合計
        </p>
        <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">
          ¥{total.toLocaleString()}
        </p>

        <div className="mt-2 text-sm">
          {prevTotal === 0 ? (
            <span className="text-gray-500">前月データなし</span>
          ) : (
            <span className={diff >= 0 ? "text-red-600" : "text-green-600"}>
              {diff >= 0 ? "▲" : "▼"} ¥{Math.abs(diff).toLocaleString()}（{rate}
              %）
            </span>
          )}
        </div>

        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            カテゴリ別 前月比
          </h3>

          {categoryDiffs.map((c) => (
            <div
              key={c.category}
              className="flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 px-3 py-2 shadow-sm"
            >
              <span className="text-sm">{c.category}</span>

              <span
                className={`text-sm font-medium ${
                  c.diff > 0
                    ? "text-red-600"
                    : c.diff < 0
                      ? "text-green-600"
                      : "text-gray-500"
                }`}
              >
                {c.diff > 0 && "▲"}
                {c.diff < 0 && "▼"}¥{Math.abs(c.diff).toLocaleString()}
                {c.rate !== null && ` (${c.rate}%)`}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 円グラフ */}
      <section className="mb-6 rounded-xl bg-white dark:bg-gray-800 p-4 shadow">
        <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          カテゴリ別
        </h2>
        {!loading && <CategoryPieChart data={summary} />}
      </section>

      {/* 一覧 */}
      <section className="space-y-2">
        {loading && <p className="text-sm text-gray-500">読み込み中...</p>}

        {!loading && expenses.length === 0 && (
          <p className="text-sm text-gray-500">まだ支出がありません</p>
        )}

        {!loading &&
          expenses.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 p-3 shadow-sm"
            >
              {/* 左側：カテゴリ・日付 */}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {e.categoryName}
                </p>
                <p className="text-xs text-gray-500">
                  {e.date}
                  {e.memo && ` · ${e.memo}`}
                </p>

                {e.tags && e.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {e.tags.map((tag) => (
                      <Link
                        key={tag.id}
                        href={`/tags/${tag.id}`}
                        className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300"
                      >
                        {tag.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* 右側：金額 + 操作 */}
              <div className="flex items-center gap-3 ml-4">
                <p className="font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  ¥{e.amount.toLocaleString()}
                </p>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditing(e)}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                    aria-label="Edit"
                  >
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </button>

                  <button
                    onClick={() => deleteExpense(e.id)}
                    className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
      </section>

      {/* 下部のボタン。重ならないよう 1 本のバーに並べ、PC では中央の列（max-w-3xl）に収める。
          幅の狭いスマホ（400px 未満）では、左右のボタンをアイコンだけにする */}
      <nav className="pointer-events-none fixed inset-x-0 bottom-4 px-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Link
            href="/categories"
            className="pointer-events-auto shrink-0 whitespace-nowrap rounded-full bg-blue-600 px-3 py-2 text-white shadow-lg"
          >
            <span aria-hidden="true">🗂️</span>
            <span className="max-[399px]:sr-only"> カテゴリ</span>
          </Link>
          <Link
            href="/add"
            className="pointer-events-auto mx-auto w-full min-w-0 max-w-md whitespace-nowrap rounded-full bg-blue-600 py-3 text-center font-semibold text-white shadow-lg active:scale-95"
          >
            ＋ 支出を追加
          </Link>
          <Link
            href="/yearly"
            className="pointer-events-auto shrink-0 whitespace-nowrap rounded-full bg-blue-600 px-3 py-2 text-white shadow-lg"
          >
            <span aria-hidden="true">📅</span>
            <span className="max-[399px]:sr-only"> 年間</span>
          </Link>
        </div>
      </nav>

      {editing && (
        <EditExpenseModal
          expense={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => fetchExpenses(month)} // 再取得関数
        />
      )}
    </main>
  );
}
