"use client";

import { useActionState, useEffect, useRef } from "react";
import type { Unit, Variant } from "@/db/schema";
import { initialActionState, type ActionState } from "@/lib/form";
import { Field, FormMessage, inputClass, LinkButton, SubmitButton } from "./ui";

/** 荷姿の入力欄。商品の登録フォームでも使う */
export function VariantFields({ variant, unit }: { variant?: Variant; unit?: Unit }) {
	return (
		<>
			<Field label={unit ? `1 個あたりの容量（${unit}）` : "1 個あたりの容量"} hint="容量や入数が違う荷姿は、商品ページで追加する">
				<input name="amount" type="number" inputMode="decimal" min={0.01} step="any" required defaultValue={variant?.amount ?? ""} className={inputClass} placeholder="例: 350" />
			</Field>
			<Field label="入数" hint="6 缶パックなら 6。単品なら 1">
				<input name="count" type="number" inputMode="numeric" min={1} step={1} defaultValue={variant?.count ?? 1} className={inputClass} />
			</Field>
		</>
	);
}

type Props = {
	action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
	productId: number;
	unit: Unit;
	/** 渡すと編集フォームになる */
	variant?: Variant;
};

export function VariantForm({ action, productId, unit, variant }: Props) {
	const [state, formAction] = useActionState(action, initialActionState);
	const formRef = useRef<HTMLFormElement>(null);
	const isEdit = variant !== undefined;

	// 追加に成功したら入力欄を初期状態へ戻す
	useEffect(() => {
		if (isEdit || !state.success) return;
		formRef.current?.reset();
	}, [state, isEdit]);

	return (
		<form ref={formRef} action={formAction} className="space-y-4">
			<input type="hidden" name="productId" value={productId} />
			{variant && <input type="hidden" name="id" value={variant.id} />}
			<FormMessage state={state} />
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<VariantFields variant={variant} unit={unit} />
			</div>
			<div className="flex gap-3">
				<SubmitButton pendingText="保存中…">{isEdit ? "更新する" : "荷姿を追加する"}</SubmitButton>
				{isEdit && <LinkButton href={`/products/${productId}`}>キャンセル</LinkButton>}
			</div>
		</form>
	);
}
