"use client";

import { useActionState, useState } from "react";
import { createField, deleteField, moveField, updateField } from "@/app/actions/fields";
import { BETTER, FIELD_KINDS, type FieldKind, type SpecField } from "@/db/schema";
import { BETTER_LABELS, KIND_LABELS } from "@/lib/compare";
import { initialActionState } from "@/lib/form";
import { ConfirmForm, DangerButton, Field, FormMessage, inputClass, SubmitButton } from "./ui";

const smallButton =
	"inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

function BetterSelect({ kind, defaultValue }: { kind: FieldKind; defaultValue?: string }) {
	// テキストは大小を比べられないので選ばせない
	if (kind === "text") return <input type="hidden" name="better" value="none" />;
	return (
		<select name="better" defaultValue={defaultValue ?? (kind === "bool" ? "higher" : "none")} className={inputClass}>
			{BETTER.map((b) => (
				<option key={b} value={b}>
					{kind === "bool" && b === "higher" ? "あるほうが良い" : kind === "bool" && b === "lower" ? "無いほうが良い" : BETTER_LABELS[b]}
				</option>
			))}
		</select>
	);
}

function FieldRow({ field, isFirst, isLast }: { field: SpecField; isFirst: boolean; isLast: boolean }) {
	const [state, formAction] = useActionState(updateField, initialActionState);
	return (
		<li className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
			<div className="flex items-center justify-between gap-2">
				<p className="text-xs text-zinc-500">{KIND_LABELS[field.kind]}</p>
				<div className="flex items-center gap-1">
					{(["up", "down"] as const).map((direction) => (
						<form key={direction} action={moveField}>
							<input type="hidden" name="id" value={field.id} />
							<input type="hidden" name="categoryId" value={field.categoryId} />
							<input type="hidden" name="direction" value={direction} />
							<button
								type="submit"
								disabled={direction === "up" ? isFirst : isLast}
								className={smallButton}
								aria-label={direction === "up" ? "左へ移動" : "右へ移動"}
								title={direction === "up" ? "比較表で左へ" : "比較表で右へ"}
							>
								{direction === "up" ? "↑" : "↓"}
							</button>
						</form>
					))}
					<ConfirmForm action={deleteField} message={`「${field.name}」を削除しますか？\n入力済みの値も消えます。`}>
						<input type="hidden" name="id" value={field.id} />
						<input type="hidden" name="categoryId" value={field.categoryId} />
						<DangerButton>削除</DangerButton>
					</ConfirmForm>
				</div>
			</div>
			<form action={formAction} className="space-y-2">
				<input type="hidden" name="id" value={field.id} />
				<input type="hidden" name="categoryId" value={field.categoryId} />
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_6rem_10rem_auto]">
					<input name="name" defaultValue={field.name} required maxLength={30} className={inputClass} aria-label="項目名" />
					{field.kind === "text" ? (
						<span />
					) : (
						<input name="unit" defaultValue={field.unit ?? ""} maxLength={10} placeholder="単位" className={inputClass} aria-label="単位" />
					)}
					{/* テキストでは hidden になり枠を取らないので、列がずれないよう包む */}
					<span>
						<BetterSelect kind={field.kind} defaultValue={field.better} />
					</span>
					<SubmitButton pendingText="…">変更</SubmitButton>
				</div>
				<FormMessage state={state} />
			</form>
		</li>
	);
}

function AddFieldForm({ categoryId }: { categoryId: number }) {
	const [state, formAction] = useActionState(createField, initialActionState);
	const [kind, setKind] = useState<FieldKind>("number");
	return (
		<form action={formAction} className="space-y-3 rounded-md border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
			<input type="hidden" name="categoryId" value={categoryId} />
			<FormMessage state={state} />
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<Field label="項目名">
					<input name="name" required maxLength={30} placeholder="例: メモリ" className={inputClass} />
				</Field>
				<Field label="値の型" hint="あとから変えられません">
					<select name="kind" value={kind} onChange={(e) => setKind(e.currentTarget.value as FieldKind)} className={inputClass}>
						{FIELD_KINDS.map((k) => (
							<option key={k} value={k}>
								{KIND_LABELS[k]}
							</option>
						))}
					</select>
				</Field>
				{kind !== "text" && (
					<Field label="単位" hint="任意">
						<input name="unit" maxLength={10} placeholder="例: GB" className={inputClass} />
					</Field>
				)}
				{kind !== "text" && (
					<Field label="良し悪し" hint="比較表で一番良い値に色を付けます">
						<BetterSelect key={kind} kind={kind} />
					</Field>
				)}
				{kind === "text" && <BetterSelect kind={kind} />}
			</div>
			<SubmitButton pendingText="追加中…">項目を追加</SubmitButton>
		</form>
	);
}

export function FieldManager({ categoryId, fields }: { categoryId: number; fields: SpecField[] }) {
	return (
		<div className="space-y-4">
			{fields.length === 0 ? (
				<p className="text-sm text-zinc-500">スペック項目はまだありません</p>
			) : (
				<ol className="space-y-2">
					{fields.map((f, i) => (
						<FieldRow key={f.id} field={f} isFirst={i === 0} isLast={i === fields.length - 1} />
					))}
				</ol>
			)}
			<AddFieldForm categoryId={categoryId} />
		</div>
	);
}
