"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { listFields } from "@/db/queries";
import { BETTER, FIELD_KINDS, specFields } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/errors";
import { idFromForm, parseForm, type ActionState } from "@/lib/form";

const fieldSchema = z.object({
	categoryId: idFromForm,
	name: z.string().trim().min(1, "項目名を入力してください").max(30),
	unit: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(10).optional()),
	better: z.enum(BETTER),
	// チェックボックスは外すと送られてこないので、値が無ければ出さない
	quickFilter: z.literal("1").optional().transform((v) => v === "1"),
});

/** text は大小を比べられないので、良し悪しの向きを持たせない */
function normalizeBetter(kind: (typeof FIELD_KINDS)[number], better: (typeof BETTER)[number]) {
	return kind === "text" ? "none" : better;
}

function revalidateCategory(categoryId: number) {
	revalidatePath(`/categories/${categoryId}`, "layout");
}

export async function createField(_prev: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const parsed = parseForm(fieldSchema.extend({ kind: z.enum(FIELD_KINDS) }), formData);
	if (!parsed.ok) return { error: parsed.error };
	const { categoryId, name, unit, kind, better, quickFilter } = parsed.data;

	const db = await getDb();
	// 末尾（比較表の右端）に足す
	const [{ last }] = await db.select({ last: max(specFields.position) }).from(specFields).where(eq(specFields.categoryId, categoryId));
	try {
		await db.insert(specFields).values({
			categoryId,
			name,
			unit: kind === "text" ? null : (unit ?? null),
			kind,
			better: normalizeBetter(kind, better),
			quickFilter,
			position: (last ?? -1) + 1,
		});
	} catch (e) {
		if (isUniqueViolation(e)) return { error: `「${name}」は既にあります` };
		throw e;
	}
	revalidateCategory(categoryId);
	return { success: `「${name}」を追加しました` };
}

/**
 * 項目の名前・単位・良し悪しの向きを変える。
 * 値の型は変えさせない。入力済みの値が新しい型で読めなくなるため、変えたいときは作り直してもらう
 */
export async function updateField(_prev: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const parsed = parseForm(fieldSchema.extend({ id: idFromForm }), formData);
	if (!parsed.ok) return { error: parsed.error };
	const { id, categoryId, name, unit, better, quickFilter } = parsed.data;

	const db = await getDb();
	const current = (
		await db
			.select()
			.from(specFields)
			.where(and(eq(specFields.id, id), eq(specFields.categoryId, categoryId)))
			.limit(1)
	)[0];
	if (!current) return { error: "項目が見つかりません" };

	try {
		await db
			.update(specFields)
			.set({ name, unit: current.kind === "text" ? null : (unit ?? null), better: normalizeBetter(current.kind, better), quickFilter })
			.where(eq(specFields.id, id));
	} catch (e) {
		if (isUniqueViolation(e)) return { error: `「${name}」は既にあります` };
		throw e;
	}
	revalidateCategory(categoryId);
	return { success: "変更しました" };
}

export async function deleteField(formData: FormData): Promise<void> {
	await requireUser();
	const parsed = parseForm(z.object({ id: idFromForm, categoryId: idFromForm }), formData);
	if (!parsed.ok) throw new Error(parsed.error);

	const db = await getDb();
	// 入力済みの値は ON DELETE CASCADE で一緒に消える
	await db.delete(specFields).where(and(eq(specFields.id, parsed.data.id), eq(specFields.categoryId, parsed.data.categoryId)));
	revalidateCategory(parsed.data.categoryId);
}

/** 項目を 1 つ左（up）か右（down）へ動かす。隣と入れ替える */
export async function moveField(formData: FormData): Promise<void> {
	await requireUser();
	const parsed = parseForm(z.object({ id: idFromForm, categoryId: idFromForm, direction: z.enum(["up", "down"]) }), formData);
	if (!parsed.ok) throw new Error(parsed.error);
	const { id, categoryId, direction } = parsed.data;

	const db = await getDb();
	const fields = await listFields(db, categoryId);
	const index = fields.findIndex((f) => f.id === id);
	const swapWith = direction === "up" ? index - 1 : index + 1;
	if (index < 0 || swapWith < 0 || swapWith >= fields.length) return;

	// position が重複していても並びが決まるよう、並べ直した順の番号を振り直す
	const reordered = fields.map((f) => f.id);
	[reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
	const [first, ...rest] = reordered.map((fieldId, position) => db.update(specFields).set({ position }).where(eq(specFields.id, fieldId)));
	await db.batch([first, ...rest]);
	revalidateCategory(categoryId);
}
