"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { priceRecords, products } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isDate } from "@/lib/date";
import {
  idFromForm,
  optionalText,
  optionalUrl,
  parseForm,
  type ActionState,
} from "@/lib/form";

const recordSchema = z.object({
  productId: idFromForm,
  store: z.string().trim().min(1, "店舗名を入力してください").max(100),
  price: z.coerce
    .number()
    .int("価格は整数で入力してください")
    .positive("価格は 1 円以上で入力してください"),
  // チェックボックスは外すと送られてこないので、値が無ければ新品とみなす
  used: z
    .literal("1")
    .optional()
    .transform((v) => v === "1"),
  recordedAt: z.string().refine(isDate, "日付の形式が不正です"),
  url: optionalUrl,
  memo: optionalText,
});

/** 比較表の最安値が変わるので、商品が属するカテゴリの表も作り直す */
async function revalidateProduct(productId: number): Promise<void> {
  const db = await getDb();
  const product = (
    await db
      .select({ categoryId: products.categoryId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)
  )[0];
  revalidatePath(`/products/${productId}`);
  if (product) revalidatePath(`/categories/${product.categoryId}`);
}

export async function createRecord(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = parseForm(recordSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const db = await getDb();
  const product = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, parsed.data.productId))
    .limit(1);
  if (product.length === 0) return { error: "商品が見つかりません" };

  // 売り切れの印は付けない。売れた出品に新しい値段を記録したら、また売り出されたものとして最新の記録が効く
  await db.insert(priceRecords).values({
    productId: parsed.data.productId,
    store: parsed.data.store,
    price: parsed.data.price,
    used: parsed.data.used,
    recordedAt: parsed.data.recordedAt,
    url: parsed.data.url ?? null,
    memo: parsed.data.memo ?? null,
  });

  await revalidateProduct(parsed.data.productId);
  return { success: "価格を記録しました" };
}

export async function updateRecord(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = parseForm(recordSchema.extend({ id: idFromForm }), formData);
  if (!parsed.ok) return { error: parsed.error };

  const db = await getDb();
  // 別の商品の記録を書き換えさせない
  const updated = await db
    .update(priceRecords)
    .set({
      store: parsed.data.store,
      price: parsed.data.price,
      used: parsed.data.used,
      recordedAt: parsed.data.recordedAt,
      url: parsed.data.url ?? null,
      memo: parsed.data.memo ?? null,
    })
    .where(
      and(
        eq(priceRecords.id, parsed.data.id),
        eq(priceRecords.productId, parsed.data.productId),
      ),
    )
    .returning({ id: priceRecords.id });
  if (updated.length === 0) return { error: "価格の記録が見つかりません" };

  await revalidateProduct(parsed.data.productId);
  redirect(`/products/${parsed.data.productId}`);
}

export async function deleteRecord(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = parseForm(
    z.object({ id: idFromForm, productId: idFromForm }),
    formData,
  );
  if (!parsed.ok) throw new Error(parsed.error);

  const db = await getDb();
  await db
    .delete(priceRecords)
    .where(
      and(
        eq(priceRecords.id, parsed.data.id),
        eq(priceRecords.productId, parsed.data.productId),
      ),
    );
  await revalidateProduct(parsed.data.productId);
}

/** 出品が売れた・在庫が切れたときに印を付ける（外せば戻る）。記録は相場として残し、最安値の候補からだけ外す */
export async function setRecordSoldOut(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = parseForm(
    z.object({
      id: idFromForm,
      productId: idFromForm,
      soldOut: z.enum(["0", "1"]),
    }),
    formData,
  );
  if (!parsed.ok) throw new Error(parsed.error);

  const db = await getDb();
  // 別の商品の記録を書き換えさせない
  const updated = await db
    .update(priceRecords)
    .set({ soldOut: parsed.data.soldOut === "1" })
    .where(
      and(
        eq(priceRecords.id, parsed.data.id),
        eq(priceRecords.productId, parsed.data.productId),
      ),
    )
    .returning({ id: priceRecords.id });
  if (updated.length === 0) throw new Error("価格の記録が見つかりません");

  await revalidateProduct(parsed.data.productId);
}
