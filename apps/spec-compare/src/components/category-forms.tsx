"use client";

import { useActionState } from "react";
import {
  createCategory,
  deleteCategory,
  renameCategory,
  setDefaultCostField,
  setScoreWeights,
} from "@/app/actions/categories";
import type { Category, SpecField } from "@/db/schema";
import { costLabel, isCostField, isRankable } from "@/lib/compare";
import { initialActionState } from "@/lib/form";
import { PRESETS } from "@/lib/presets";
import { Field, FormMessage, inputClass, SubmitButton } from "./ui";

export function CreateCategoryForm() {
  const [state, formAction] = useActionState(
    createCategory,
    initialActionState,
  );
  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="カテゴリ名">
          <input
            name="name"
            required
            maxLength={50}
            placeholder="例: ノート PC"
            className={inputClass}
          />
        </Field>
        <Field
          label="スペック項目のひな形"
          hint="あとから項目を足したり消したりできます"
        >
          <select name="preset" defaultValue="" className={inputClass}>
            <option value="">なし（自分で項目を作る）</option>
            {PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}（{p.fields.map((f) => f.name).join("・")}）
              </option>
            ))}
          </select>
        </Field>
      </div>
      <SubmitButton pendingText="作成中…">カテゴリを作る</SubmitButton>
    </form>
  );
}

export function RenameCategoryForm({ category }: { category: Category }) {
  const [state, formAction] = useActionState(
    renameCategory,
    initialActionState,
  );
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={category.id} />
      <div className="flex gap-2">
        <input
          name="name"
          defaultValue={category.name}
          required
          maxLength={50}
          className={inputClass}
          aria-label="カテゴリ名"
        />
        <SubmitButton pendingText="…">変更</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function DeleteCategoryForm({ category }: { category: Category }) {
  const [state, formAction] = useActionState(
    deleteCategory,
    initialActionState,
  );
  return (
    <form
      action={formAction}
      className="space-y-2"
      onSubmit={(e) => {
        if (
          !window.confirm(
            `「${category.name}」を削除しますか？\nスペック項目も一緒に消えます。`,
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={category.id} />
      <FormMessage state={state} />
      <button
        type="submit"
        className="inline-flex items-center rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
      >
        カテゴリを削除
      </button>
    </form>
  );
}

/** 比較表を開いたときに出すコスパ列。選べるのは大きいほど良い数値の項目だけ */
export function DefaultCostForm({
  category,
  fields,
}: {
  category: Category;
  fields: readonly SpecField[];
}) {
  const [state, formAction] = useActionState(
    setDefaultCostField,
    initialActionState,
  );
  const costFields = fields.filter(isCostField);
  if (costFields.length === 0)
    return (
      <p className="text-sm text-zinc-500">
        大きいほど良い数値の項目を作ると選べます。
      </p>
    );
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={category.id} />
      <div className="flex gap-2">
        <select
          name="fieldId"
          defaultValue={category.defaultCostFieldId ?? ""}
          className={inputClass}
          aria-label="既定のコスパの基準"
        >
          <option value="">出さない</option>
          {costFields.map((f) => (
            <option key={f.id} value={f.id}>
              {costLabel(f)}の価格
            </option>
          ))}
        </select>
        <SubmitButton pendingText="…">変更</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

/** 総合スコアの重み。比べられる項目（大きい / 小さいほど良い）と最安値に 0〜10 を付ける */
export function ScoreWeightsForm({
  category,
  fields,
}: {
  category: Category;
  fields: readonly SpecField[];
}) {
  const [state, formAction] = useActionState(
    setScoreWeights,
    initialActionState,
  );
  const rows = [
    { name: "w_price", label: "最安値", weight: category.priceScoreWeight },
    ...fields.filter(isRankable).map((f) => ({
      name: `w_${f.id}`,
      label: f.name,
      weight: f.scoreWeight,
    })),
  ];
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={category.id} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map((r) => (
          <label key={r.name} className="block space-y-1 text-sm">
            <span className="block truncate font-medium text-zinc-700 dark:text-zinc-300">
              {r.label}
            </span>
            <input
              name={r.name}
              type="number"
              inputMode="numeric"
              min={0}
              max={10}
              step={1}
              defaultValue={r.weight}
              className={inputClass}
            />
          </label>
        ))}
      </div>
      <SubmitButton pendingText="…">変更</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
