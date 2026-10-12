"use client";

import { useActionState } from "react";
import { createCategory, deleteCategory, renameCategory } from "@/app/actions/categories";
import type { Category } from "@/db/schema";
import { initialActionState } from "@/lib/form";
import { PRESETS } from "@/lib/presets";
import { Field, FormMessage, inputClass, SubmitButton } from "./ui";

export function CreateCategoryForm() {
	const [state, formAction] = useActionState(createCategory, initialActionState);
	return (
		<form action={formAction} className="space-y-3">
			<FormMessage state={state} />
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<Field label="カテゴリ名">
					<input name="name" required maxLength={50} placeholder="例: ノート PC" className={inputClass} />
				</Field>
				<Field label="スペック項目のひな形" hint="あとから項目を足したり消したりできます">
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
	const [state, formAction] = useActionState(renameCategory, initialActionState);
	return (
		<form action={formAction} className="space-y-2">
			<input type="hidden" name="id" value={category.id} />
			<div className="flex gap-2">
				<input name="name" defaultValue={category.name} required maxLength={50} className={inputClass} aria-label="カテゴリ名" />
				<SubmitButton pendingText="…">変更</SubmitButton>
			</div>
			<FormMessage state={state} />
		</form>
	);
}

export function DeleteCategoryForm({ category }: { category: Category }) {
	const [state, formAction] = useActionState(deleteCategory, initialActionState);
	return (
		<form
			action={formAction}
			className="space-y-2"
			onSubmit={(e) => {
				if (!window.confirm(`「${category.name}」を削除しますか？\nスペック項目も一緒に消えます。`)) e.preventDefault();
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
