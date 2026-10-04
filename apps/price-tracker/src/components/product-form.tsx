"use client";

import { useActionState } from "react";
import type { Category, Product } from "@/db/schema";
import { UNITS } from "@/db/schema";
import { initialActionState, type ActionState } from "@/lib/form";
import { imageUrl } from "@/lib/images";
import { PRODUCT_IMAGE } from "@/lib/image-shrink";
import { ImageInput } from "./image-input";
import { VariantFields } from "./variant-form";
import { Field, FormMessage, inputClass, LinkButton, SubmitButton } from "./ui";

type Props = {
	action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
	categories: Category[];
	makers: string[];
	product?: Product;
};

export function ProductForm({ action, categories, makers, product }: Props) {
	const [state, formAction] = useActionState(action, initialActionState);

	return (
		<form action={formAction} className="space-y-5">
			{product && <input type="hidden" name="id" value={product.id} />}
			<FormMessage state={state} />

			<Field label="商品名">
				<input name="name" required maxLength={100} defaultValue={product?.name} className={inputClass} placeholder="例: 無調整豆乳" />
			</Field>

			<Field label="メーカー" hint="任意">
				<input name="maker" maxLength={500} list="maker-suggestions" defaultValue={product?.maker ?? ""} className={inputClass} placeholder="例: キッコーマン" />
				<datalist id="maker-suggestions">
					{makers.map((m) => (
						<option key={m} value={m} />
					))}
				</datalist>
			</Field>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<Field label="カテゴリ">
					<select name="categoryId" defaultValue={product?.categoryId ?? ""} className={inputClass}>
						<option value="">未分類</option>
						{categories.map((c) => (
							<option key={c.id} value={c.id}>
								{c.name}
							</option>
						))}
					</select>
				</Field>
				<Field label="容量の単位" hint="荷姿すべてに共通。g / ml は 100 あたり、それ以外は 1 あたりの単価を表示します">
					<select name="unit" defaultValue={product?.unit ?? "g"} className={inputClass}>
						{UNITS.map((u) => (
							<option key={u} value={u}>
								{u}
							</option>
						))}
					</select>
				</Field>
			</div>

			{/* 荷姿は商品の登録時に最初の 1 件だけ受け取る。以降の追加・編集は商品ページで行う */}
			{!product && (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<VariantFields />
				</div>
			)}

			<Field label="画像">
				<ImageInput name="image" profile={PRODUCT_IMAGE} currentUrl={product?.imageKey ? imageUrl(product.imageKey) : null} />
			</Field>
			{product?.imageKey && (
				<label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
					<input type="checkbox" name="removeImage" /> 画像を削除する
				</label>
			)}

			<Field label="メモ">
				<textarea name="memo" rows={3} maxLength={500} defaultValue={product?.memo ?? ""} className={inputClass} />
			</Field>

			<div className="flex gap-3">
				<SubmitButton pendingText="保存中…">{product ? "更新する" : "登録する"}</SubmitButton>
				<LinkButton href={product ? `/products/${product.id}` : "/"}>キャンセル</LinkButton>
			</div>
		</form>
	);
}
