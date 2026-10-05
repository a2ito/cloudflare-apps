"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { priceRecords, products, UNITS, variants } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { idFromForm, optionalIdFromForm, optionalPositiveNumber, optionalText, parseForm, variantFields, type ActionState } from "@/lib/form";
import { releaseImage } from "@/lib/image-cleanup";
import { storeImage } from "@/lib/images";

const productSchema = z.object({
	name: z.string().trim().min(1, "商品名を入力してください").max(100),
	maker: optionalText,
	categoryId: optionalIdFromForm,
	unit: z.enum(UNITS),
	memo: optionalText,
	metricName: optionalText,
	metricUnit: optionalText,
	metricBasis: optionalPositiveNumber("基準量"),
	metricAmount: optionalPositiveNumber("含有量"),
});

type MetricInput = Pick<z.infer<typeof productSchema>, "metricName" | "metricUnit" | "metricBasis" | "metricAmount">;
type MetricColumns = { metricName: string | null; metricUnit: string | null; metricBasis: number | null; metricAmount: number | null };

/**
 * 比較軸の 4 項目は、全部入れるか全部空にするかのどちらか。
 * 一部だけだと単価を出せないのに、入れたつもりの値が黙って無視されるため弾く
 */
function metricColumns(input: MetricInput): { ok: true; value: MetricColumns } | { ok: false; error: string } {
	const values = [input.metricName, input.metricUnit, input.metricBasis, input.metricAmount];
	if (values.every((v) => v === undefined)) {
		return { ok: true, value: { metricName: null, metricUnit: null, metricBasis: null, metricAmount: null } };
	}
	if (values.some((v) => v === undefined)) {
		return { ok: false, error: "比較軸は、名前・単位・基準量・含有量をすべて入れるか、すべて空にしてください" };
	}
	return {
		ok: true,
		value: {
			metricName: input.metricName ?? null,
			metricUnit: input.metricUnit ?? null,
			metricBasis: input.metricBasis ?? null,
			metricAmount: input.metricAmount ?? null,
		},
	};
}

function imageFile(formData: FormData): File | null {
	const value = formData.get("image");
	return value instanceof File ? value : null;
}

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	// 最初の荷姿もあわせて受け取る
	const parsed = parseForm(productSchema.extend(variantFields), formData);
	if (!parsed.ok) return { error: parsed.error };
	const metric = metricColumns(parsed.data);
	if (!metric.ok) return { error: metric.error };

	let imageKey: string | null = null;
	try {
		imageKey = await storeImage(imageFile(formData));
	} catch (e) {
		return { error: e instanceof Error ? e.message : "画像の保存に失敗しました" };
	}

	const db = await getDb();
	const inserted = await db
		.insert(products)
		.values({
			name: parsed.data.name,
			maker: parsed.data.maker ?? null,
			categoryId: parsed.data.categoryId ?? null,
			unit: parsed.data.unit,
			memo: parsed.data.memo ?? null,
			...metric.value,
			imageKey,
		})
		.returning({ id: products.id });

	const id = inserted[0]?.id;
	if (id === undefined) return { error: "商品の登録に失敗しました" };
	await db.insert(variants).values({ productId: id, amount: parsed.data.amount, count: parsed.data.count });

	revalidatePath("/");
	redirect(`/products/${id}`);
}

export async function updateProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const parsed = parseForm(productSchema.extend({ id: idFromForm, removeImage: z.string().optional() }), formData);
	if (!parsed.ok) return { error: parsed.error };
	const metric = metricColumns(parsed.data);
	if (!metric.ok) return { error: metric.error };

	const db = await getDb();
	const current = (await db.select().from(products).where(eq(products.id, parsed.data.id)).limit(1))[0];
	if (!current) return { error: "商品が見つかりません" };

	let imageKey = current.imageKey;
	try {
		const newKey = await storeImage(imageFile(formData));
		if (newKey) imageKey = newKey;
		else if (parsed.data.removeImage === "on") imageKey = null;
	} catch (e) {
		return { error: e instanceof Error ? e.message : "画像の保存に失敗しました" };
	}

	await db
		.update(products)
		.set({
			name: parsed.data.name,
			maker: parsed.data.maker ?? null,
			categoryId: parsed.data.categoryId ?? null,
			unit: parsed.data.unit,
			memo: parsed.data.memo ?? null,
			...metric.value,
			imageKey,
			updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
		})
		.where(eq(products.id, parsed.data.id));

	// 参照が切れたことを確かめてから消すため、DB を更新したあとに片付ける
	if (imageKey !== current.imageKey) await releaseImage(db, current.imageKey);

	revalidatePath("/");
	revalidatePath(`/products/${parsed.data.id}`);
	redirect(`/products/${parsed.data.id}`);
}

export async function deleteProduct(formData: FormData): Promise<void> {
	await requireUser();
	const parsed = parseForm(z.object({ id: idFromForm }), formData);
	if (!parsed.ok) throw new Error(parsed.error);

	const db = await getDb();
	const current = (await db.select().from(products).where(eq(products.id, parsed.data.id)).limit(1))[0];
	if (current) {
		const records = await db
			.select({ imageKey: priceRecords.imageKey })
			.from(priceRecords)
			.where(
				inArray(
					priceRecords.variantId,
					db.select({ id: variants.id }).from(variants).where(eq(variants.productId, parsed.data.id)),
				),
			);
		// 行は ON DELETE CASCADE で消えるが R2 の画像は残る。
		// 他の商品と共有しているキーを巻き添えにしないよう、行を消したあとに片付ける
		await db.delete(products).where(eq(products.id, parsed.data.id));
		for (const key of [current.imageKey, ...records.map((r) => r.imageKey)]) {
			await releaseImage(db, key);
		}
	}
	revalidatePath("/");
	redirect("/");
}

/**
 * 商品を別の商品へ統合する。荷姿（と紐づく価格記録）をすべて統合先へ移し、元の商品を消す。
 * 名前・メーカー・画像などは統合先のものが残る
 */
export async function mergeProduct(formData: FormData): Promise<void> {
	await requireUser();
	const parsed = parseForm(z.object({ id: idFromForm, targetId: idFromForm }), formData);
	if (!parsed.ok) throw new Error(parsed.error);
	const { id, targetId } = parsed.data;
	if (id === targetId) throw new Error("同じ商品へは統合できません");

	const db = await getDb();
	const [source, target] = await Promise.all([
		db.select().from(products).where(eq(products.id, id)).limit(1),
		db.select().from(products).where(eq(products.id, targetId)).limit(1),
	]);
	if (!source[0] || !target[0]) throw new Error("商品が見つかりません");
	if (source[0].unit !== target[0].unit) throw new Error("単位が違う商品へは統合できません");

	// 荷姿を移す前に商品が消えると CASCADE で記録まで消えるため、1 つのトランザクションで順に流す
	await db.batch([
		db.update(variants).set({ productId: targetId }).where(eq(variants.productId, id)),
		db.delete(products).where(eq(products.id, id)),
	]);
	// 参照が切れたことを確かめてから消すため、DB を更新したあとに片付ける
	await releaseImage(db, source[0].imageKey);

	revalidatePath("/");
	revalidatePath(`/products/${targetId}`);
	redirect(`/products/${targetId}`);
}
