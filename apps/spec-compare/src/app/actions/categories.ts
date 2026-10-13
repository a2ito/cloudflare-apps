"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { categories, products, specFields } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/errors";
import { isCostField } from "@/lib/compare";
import { idFromForm, optionalIdFromForm, parseForm, type ActionState } from "@/lib/form";
import { findPreset } from "@/lib/presets";

const nameSchema = z.string().trim().min(1, "カテゴリ名を入力してください").max(50);

export async function createCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const parsed = parseForm(z.object({ name: nameSchema, preset: z.string().optional() }), formData);
	if (!parsed.ok) return { error: parsed.error };
	const preset = findPreset(parsed.data.preset);

	const db = await getDb();
	let id: number | undefined;
	try {
		const inserted = await db.insert(categories).values({ name: parsed.data.name }).returning({ id: categories.id });
		id = inserted[0]?.id;
	} catch (e) {
		if (isUniqueViolation(e)) return { error: `「${parsed.data.name}」は既に存在します` };
		throw e;
	}
	if (id === undefined) return { error: "カテゴリの登録に失敗しました" };

	if (preset) {
		const categoryId = id;
		await db.insert(specFields).values(
			preset.fields.map((f, i) => ({ categoryId, name: f.name, unit: f.unit ?? null, kind: f.kind, better: f.better, position: i })),
		);
	}

	revalidatePath("/");
	redirect(`/categories/${id}`);
}

export async function renameCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const parsed = parseForm(z.object({ id: idFromForm, name: nameSchema }), formData);
	if (!parsed.ok) return { error: parsed.error };

	const db = await getDb();
	try {
		await db.update(categories).set({ name: parsed.data.name }).where(eq(categories.id, parsed.data.id));
	} catch (e) {
		if (isUniqueViolation(e)) return { error: `「${parsed.data.name}」は既に存在します` };
		throw e;
	}
	revalidatePath("/");
	revalidatePath(`/categories/${parsed.data.id}`, "layout");
	return { success: "変更しました" };
}

/** 比較表を開いたときに出すコスパ列の項目を決める。空なら出さない */
export async function setDefaultCostField(_prev: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const parsed = parseForm(z.object({ id: idFromForm, fieldId: optionalIdFromForm }), formData);
	if (!parsed.ok) return { error: parsed.error };

	const db = await getDb();
	const fieldId = parsed.data.fieldId ?? null;
	if (fieldId !== null) {
		// 別のカテゴリの項目や、コスパにならない項目を選ばせない
		const field = (await db.select().from(specFields).where(and(eq(specFields.id, fieldId), eq(specFields.categoryId, parsed.data.id))).limit(1))[0];
		if (!field || !isCostField(field)) return { error: "コスパに使えるのは、大きいほど良い数値の項目だけです" };
	}

	await db.update(categories).set({ defaultCostFieldId: fieldId }).where(eq(categories.id, parsed.data.id));
	revalidatePath(`/categories/${parsed.data.id}`, "layout");
	return { success: "変更しました" };
}

/**
 * カテゴリを消す。商品が残っているカテゴリは消さない。
 * 商品ごと消すと画像や価格の記録まで一度に失うので、商品を先に消してもらう
 */
export async function deleteCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const parsed = parseForm(z.object({ id: idFromForm }), formData);
	if (!parsed.ok) return { error: parsed.error };

	const db = await getDb();
	const [{ n }] = await db.select({ n: count() }).from(products).where(eq(products.categoryId, parsed.data.id));
	if (n > 0) return { error: `商品が ${n} 件残っています。先に商品を削除してください` };

	// スペック項目は ON DELETE CASCADE で一緒に消える
	await db.delete(categories).where(eq(categories.id, parsed.data.id));
	revalidatePath("/");
	redirect("/");
}
