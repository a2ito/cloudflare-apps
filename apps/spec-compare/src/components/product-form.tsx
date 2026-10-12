"use client";

import { useActionState } from "react";
import type { Product, SpecField } from "@/db/schema";
import type { SpecCell } from "@/lib/compare";
import { initialActionState, type ActionState } from "@/lib/form";
import { imageUrl } from "@/lib/images";
import { PRODUCT_IMAGE } from "@/lib/image-shrink";
import { BOOL_NO, BOOL_YES, SPEC_TEXT_MAX, specDefaultValue, specInputName } from "@/lib/spec-form";
import { ImageInput } from "./image-input";
import { Field, FormMessage, inputClass, LinkButton, SubmitButton } from "./ui";

type Props = {
	action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
	categoryId: number;
	fields: SpecField[];
	makers: string[];
	stores: string[];
	/** 渡すと編集フォームになる */
	product?: Product;
	specs?: Record<number, SpecCell>;
};

function SpecInput({ field, cell }: { field: SpecField; cell: SpecCell | undefined }) {
	const name = specInputName(field.id);
	const defaultValue = specDefaultValue(field.kind, cell);
	const label = field.unit ? `${field.name}（${field.unit}）` : field.name;

	if (field.kind === "bool") {
		return (
			<Field label={label}>
				<select name={name} defaultValue={defaultValue} className={inputClass}>
					<option value="">未入力</option>
					<option value={BOOL_YES}>あり</option>
					<option value={BOOL_NO}>なし</option>
				</select>
			</Field>
		);
	}
	if (field.kind === "text") {
		return (
			<Field label={label}>
				<input name={name} defaultValue={defaultValue} maxLength={SPEC_TEXT_MAX} className={inputClass} />
			</Field>
		);
	}
	// type="number" だと貼り付けた「1,024」や全角数字を受け付けないため、text で受けてサーバーで数値にする
	return (
		<Field label={label}>
			<input name={name} defaultValue={defaultValue} inputMode="decimal" className={inputClass} />
		</Field>
	);
}

export function ProductForm({ action, categoryId, fields, makers, stores, product, specs }: Props) {
	const [state, formAction] = useActionState(action, initialActionState);
	const isEdit = product !== undefined;

	return (
		<form action={formAction} className="space-y-5">
			{isEdit ? <input type="hidden" name="id" value={product.id} /> : <input type="hidden" name="categoryId" value={categoryId} />}
			<FormMessage state={state} />

			<Field label="商品名">
				<input name="name" required maxLength={100} defaultValue={product?.name} className={inputClass} placeholder="例: MacBook Air 13 M4" />
			</Field>

			<Field label="メーカー" hint="任意">
				<input name="maker" maxLength={500} list="maker-suggestions" defaultValue={product?.maker ?? ""} className={inputClass} placeholder="例: Apple" />
				<datalist id="maker-suggestions">
					{makers.map((m) => (
						<option key={m} value={m} />
					))}
				</datalist>
			</Field>

			<fieldset className="space-y-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
				<legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">スペック</legend>
				{fields.length === 0 ? (
					<p className="text-sm text-zinc-500">このカテゴリにはスペック項目がありません</p>
				) : (
					<>
						<p className="text-xs text-zinc-500">分からない項目は空欄のままで構いません</p>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							{fields.map((f) => (
								<SpecInput key={f.id} field={f} cell={specs?.[f.id]} />
							))}
						</div>
					</>
				)}
			</fieldset>

			{/* 価格は店舗ごとに何件も持てる。登録時は最初の 1 件だけ受け取り、以降は商品ページで足す */}
			{!isEdit && (
				<fieldset className="space-y-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
					<legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">価格（任意）</legend>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<Field label="店舗">
							<input name="store" list="store-suggestions" maxLength={100} className={inputClass} placeholder="例: ヨドバシ.com" />
							<datalist id="store-suggestions">
								{stores.map((s) => (
									<option key={s} value={s} />
								))}
							</datalist>
						</Field>
						<Field label="税込価格（円）">
							<input name="price" type="number" inputMode="numeric" min={1} step={1} className={inputClass} />
						</Field>
					</div>
					<Field label="リンク" hint="商品ページの URL">
						<input name="url" type="url" inputMode="url" maxLength={2000} className={inputClass} placeholder="https://..." />
					</Field>
				</fieldset>
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
				<SubmitButton pendingText="保存中…">{isEdit ? "更新する" : "登録する"}</SubmitButton>
				<LinkButton href={isEdit ? `/products/${product.id}` : `/categories/${categoryId}`}>キャンセル</LinkButton>
			</div>
		</form>
	);
}
