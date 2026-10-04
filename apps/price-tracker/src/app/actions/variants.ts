"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { priceRecords, variants } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { idFromForm, parseForm, variantFields, type ActionState } from "@/lib/form";
import { releaseImage } from "@/lib/image-cleanup";

const variantSchema = z.object({ productId: idFromForm, ...variantFields });

export async function createVariant(_prev: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const parsed = parseForm(variantSchema, formData);
	if (!parsed.ok) return { error: parsed.error };

	const db = await getDb();
	await db.insert(variants).values({ productId: parsed.data.productId, amount: parsed.data.amount, count: parsed.data.count });

	revalidatePath("/");
	revalidatePath(`/products/${parsed.data.productId}`);
	return { success: "荷姿を追加しました" };
}

export async function updateVariant(_prev: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const parsed = parseForm(variantSchema.extend({ id: idFromForm }), formData);
	if (!parsed.ok) return { error: parsed.error };

	const db = await getDb();
	// 別の商品の荷姿を書き換えさせない
	const updated = await db
		.update(variants)
		.set({ amount: parsed.data.amount, count: parsed.data.count })
		.where(and(eq(variants.id, parsed.data.id), eq(variants.productId, parsed.data.productId)))
		.returning({ id: variants.id });
	if (updated.length === 0) return { error: "荷姿が見つかりません" };

	revalidatePath("/");
	revalidatePath(`/products/${parsed.data.productId}`);
	redirect(`/products/${parsed.data.productId}`);
}

export async function deleteVariant(formData: FormData): Promise<void> {
	await requireUser();
	const parsed = parseForm(z.object({ id: idFromForm, productId: idFromForm }), formData);
	if (!parsed.ok) throw new Error(parsed.error);
	const { id, productId } = parsed.data;

	const db = await getDb();
	const current = (
		await db
			.select()
			.from(variants)
			.where(and(eq(variants.id, id), eq(variants.productId, productId)))
			.limit(1)
	)[0];
	if (current) {
		const siblings = (await db.select({ n: count() }).from(variants).where(eq(variants.productId, productId)))[0]?.n ?? 0;
		// 荷姿の無い商品は価格を記録できなくなるため、最後の 1 件は商品ごと消してもらう
		if (siblings <= 1) throw new Error("最後の荷姿は削除できません。商品ごと削除してください");

		const records = await db.select({ imageKey: priceRecords.imageKey }).from(priceRecords).where(eq(priceRecords.variantId, id));
		// 記録は ON DELETE CASCADE で消える。画像は共有の可能性があるので行を消したあとに片付ける
		await db.delete(variants).where(eq(variants.id, id));
		for (const r of records) await releaseImage(db, r.imageKey);
	}
	revalidatePath("/");
	revalidatePath(`/products/${productId}`);
}
