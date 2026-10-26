"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TagSelector from "@/components/TagSelector";
import ReceiptPicker from "@/components/ReceiptPicker";
import { uploadReceipt } from "@/lib/resizeImage";

type Category = {
  id: number;
  name: string;
};

export default function AddExpensePage() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCategories = async () => {
      const res = await fetch("/api/categories");
      const data: Category[] = (await res.json()) as Category[];
      setCategories(data);
    };

    loadCategories();
  }, []);

  const addCategory = async () => {
    if (!newCategory.trim()) return;

    await fetch("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: newCategory }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await fetch("/api/categories");
    const data: Category[] = (await res.json()) as Category[];
    setCategories(data);
    setNewCategory("");
  };

  const saveExpense = async () => {
    if (!amount || !categoryId) return;

    setSaving(true);

    const res = await fetch("/api/expenses", {
      method: "POST",
      body: JSON.stringify({
        amount: Number(amount),
        categoryId,
        date,
        memo: memo || null,
        tagIds,
      }),
      headers: { "Content-Type": "application/json" },
    });

    if (receipt && res.ok) {
      const { id } = (await res.json()) as { id: number };
      try {
        await uploadReceipt(id, receipt);
      } catch (err) {
        // 支出は保存できているので、ここで止めると二重登録になる。知らせて一覧へ戻す
        window.alert(
          `${err instanceof Error ? err.message : String(err)}\n支出は保存しました。編集から付け直してください`,
        );
      }
    }

    router.push("/");
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-28">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        支出を追加
      </h1>

      <div className="space-y-4">
        {/* 金額 */}
        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
            金額
          </label>
          <input
            type="number"
            inputMode="numeric"
            className="w-full rounded-lg border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
            placeholder="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {/* カテゴリ */}
        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
            カテゴリ
          </label>
          <select
            className="w-full rounded-lg border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
            value={categoryId}
            onChange={(e) => setCategoryId(Number(e.target.value))}
          >
            <option value="">選択してください</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* カテゴリ追加 */}
          <div className="mt-2 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-gray-300 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              placeholder="新しいカテゴリ"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <button
              type="button"
              onClick={addCategory}
              className="rounded-lg bg-gray-200 px-3 text-sm dark:bg-gray-700"
            >
              追加
            </button>
          </div>
        </div>

        {/* 日付 */}
        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
            日付
          </label>
          <input
            type="date"
            className="w-full rounded-lg border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* メモ */}
        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
            メモ
          </label>
          <input
            className="w-full rounded-lg border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
            placeholder="任意"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        {/* タグ */}
        <TagSelector selectedTagIds={tagIds} onChange={setTagIds} />

        {/* レシート */}
        <ReceiptPicker file={receipt} onFileChange={setReceipt} />
      </div>

      {/* 保存ボタン */}
      <button
        onClick={saveExpense}
        disabled={saving}
        className="fixed bottom-4 left-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-full bg-blue-600 py-3 font-semibold text-white shadow-lg disabled:opacity-50"
      >
        保存
      </button>
    </main>
  );
}
