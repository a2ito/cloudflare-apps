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

			<fieldset className="space-y-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
				<legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">比較軸（任意）</legend>
				<p className="text-xs text-zinc-500">
					単価とは別に比べたい成分があれば、栄養表示をそのまま入れる。プロテインなら「30g あたり タンパク質 21g」。
					すべて入れるか、すべて空にする
				</p>
				<div className="grid grid-cols-2 gap-3">
					<Field label="名前">
						<input name="metricName" maxLength={20} defaultValue={product?.metricName ?? ""} className={inputClass} placeholder="例: タンパク質" />
					</Field>
					<Field label="単位">
						<input name="metricUnit" maxLength={10} defaultValue={product?.metricUnit ?? ""} className={inputClass} placeholder="例: g" />
					</Field>
					<Field label="基準量" hint="商品の単位で。30g あたりなら 30">
						<input name="metricBasis" type="number" inputMode="decimal" min={0.01} step="any" defaultValue={product?.metricBasis ?? ""} className={inputClass} placeholder="例: 30" />
					</Field>
					<Field label="含有量" hint="基準量あたりの量">
						<input name="metricAmount" type="number" inputMode="decimal" min={0.01} step="any" defaultValue={product?.metricAmount ?? ""} className={inputClass} placeholder="例: 21" />
					</Field>
				</div>
			</fieldset>

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
