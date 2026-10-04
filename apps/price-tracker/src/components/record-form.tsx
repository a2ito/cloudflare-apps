"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { PriceRecord, Unit } from "@/db/schema";
import { initialActionState, type ActionState } from "@/lib/form";
import { imageUrl } from "@/lib/images";
import { formatAmount, todayIso } from "@/lib/price";
import { RECORD_PHOTO } from "@/lib/image-shrink";
import { ImageInput } from "./image-input";
import { Field, FormMessage, inputClass, LinkButton, SubmitButton } from "./ui";

type Props = {
	action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
	productId: number;
	variantId: number;
	unit: Unit;
	/** 荷姿 1 パッケージの合計容量。表示にのみ使う */
	amount: number;
	stores: string[];
	/** 渡すと編集フォームになる */
	record?: PriceRecord;
};

export function RecordForm({ action, productId, variantId, unit, amount, stores, record }: Props) {
	const [state, formAction] = useActionState(action, initialActionState);
	const formRef = useRef<HTMLFormElement>(null);
	// 記録するたびに画像入力を初期状態へ戻すための鍵
	const [imageResetKey, setImageResetKey] = useState(0);
	const isEdit = record !== undefined;

	// 新規登録が成功したら入力欄を空にして、続けて別の店を記録できるようにする
	useEffect(() => {
		if (isEdit || !state.success || !formRef.current) return;
		for (const name of ["price", "url", "memo"]) {
			const el = formRef.current.elements.namedItem(name);
			if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = "";
		}
		setImageResetKey((n) => n + 1);
	}, [state, isEdit]);

	return (
		<form ref={formRef} action={formAction} className="space-y-4">
			<input type="hidden" name="productId" value={productId} />
			<input type="hidden" name="variantId" value={variantId} />
			{record && <input type="hidden" name="id" value={record.id} />}
			<FormMessage state={state} />

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<Field label="店舗">
					<input name="store" required list={`store-suggestions-${variantId}`} defaultValue={record?.store} className={inputClass} placeholder="例: OK ストア" />
					<datalist id={`store-suggestions-${variantId}`}>
						{stores.map((s) => (
							<option key={s} value={s} />
						))}
					</datalist>
				</Field>
				<Field label="記録日">
					<input name="recordedAt" type="date" required defaultValue={record?.recordedAt ?? todayIso()} className={inputClass} />
				</Field>
				<Field label="税込価格（円）">
					<input name="price" type="number" inputMode="numeric" min={1} step={1} required defaultValue={record?.price} className={inputClass} />
				</Field>
				<Field label="個数" hint={`1 個 = ${formatAmount(amount, 1, unit)}。まとめ買いした場合は個数を増やす`}>
					<input name="quantity" type="number" inputMode="numeric" min={1} step={1} defaultValue={record?.quantity ?? 1} className={inputClass} />
				</Field>
			</div>

			<Field label="リンク" hint="商品ページやチラシの URL（任意）">
				<input name="url" type="url" inputMode="url" maxLength={2000} defaultValue={record?.url ?? ""} className={inputClass} placeholder="https://..." />
			</Field>

			<Field label="メモ">
				<input name="memo" maxLength={500} defaultValue={record?.memo ?? ""} className={inputClass} placeholder="セール価格、会員価格など" />
			</Field>

			<Field label="写真（値札やレシートなど・任意）">
				<ImageInput key={imageResetKey} name="image" profile={RECORD_PHOTO} currentUrl={record?.imageKey ? imageUrl(record.imageKey) : null} />
			</Field>
			{record?.imageKey && (
				<label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
					<input type="checkbox" name="removeImage" /> 写真を削除する
				</label>
			)}

			<div className="flex gap-3">
				<SubmitButton pendingText={isEdit ? "保存中…" : "記録中…"}>{isEdit ? "更新する" : "価格を記録する"}</SubmitButton>
				{isEdit && <LinkButton href={`/products/${productId}`}>キャンセル</LinkButton>}
			</div>
		</form>
	);
}
