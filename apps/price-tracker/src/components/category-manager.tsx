"use client";

import { useActionState } from "react";
import {
  createCategory,
  deleteCategory,
  renameCategory,
} from "@/app/actions/categories";
import type { Category } from "@/db/schema";
import { initialActionState } from "@/lib/form";
import {
  ConfirmForm,
  DangerButton,
  FormMessage,
  inputClass,
  SubmitButton,
} from "./ui";

function RenameRow({ category }: { category: Category }) {
  const [state, formAction] = useActionState(
    renameCategory,
    initialActionState,
  );
  return (
    <li className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <form action={formAction} className="flex flex-1 items-center gap-2">
          <input type="hidden" name="id" value={category.id} />
          <input
            name="name"
            defaultValue={category.name}
            required
            maxLength={50}
            className={inputClass}
          />
          <SubmitButton pendingText="…">変更</SubmitButton>
        </form>
        <ConfirmForm
          action={deleteCategory}
          message={`「${category.name}」を削除しますか？\n所属する商品は「未分類」になります。`}
        >
          <input type="hidden" name="id" value={category.id} />
          <DangerButton>削除</DangerButton>
        </ConfirmForm>
      </div>
      <FormMessage state={state} />
    </li>
  );
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [state, formAction] = useActionState(
    createCategory,
    initialActionState,
  );

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-2">
        <div className="flex gap-2">
          <input
            name="name"
            required
            maxLength={50}
            placeholder="新しいカテゴリ名"
            className={inputClass}
          />
          <SubmitButton pendingText="…">追加</SubmitButton>
        </div>
        <FormMessage state={state} />
      </form>

      {categories.length === 0 ? (
        <p className="text-sm text-zinc-500">カテゴリはまだありません</p>
      ) : (
        <ul className="space-y-2">
          {categories.map((c) => (
            <RenameRow key={c.id} category={c} />
          ))}
        </ul>
      )}
    </div>
  );
}
