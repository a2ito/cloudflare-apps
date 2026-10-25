"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { listFields } from "@/db/queries";
import { categories, products, specFields } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/errors";
import { isCostField, isRankable } from "@/lib/compare";
import {
  idFromForm,
  optionalIdFromForm,
  parseForm,
  type ActionState,
} from "@/lib/form";
import { findPreset } from "@/lib/presets";

const nameSchema = z
  .string()
  .trim()
  .min(1, "カテゴリ名を入力してください")
  .max(50);

export async function createCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = parseForm(
    z.object({ name: nameSchema, preset: z.string().optional() }),
    formData,
  );
  if (!parsed.ok) return { error: parsed.error };
  const preset = findPreset(parsed.data.preset);

  const db = await getDb();
  let id: number | undefined;
  try {
    const inserted = await db
      .insert(categories)
      .values({
        name: parsed.data.name,
        priceScoreWeight: preset?.priceScoreWeight ?? 0,
      })
      .returning({ id: categories.id });
    id = inserted[0]?.id;
  } catch (e) {
    if (isUniqueViolation(e))
      return { error: `「${parsed.data.name}」は既に存在します` };
    throw e;
  }
  if (id === undefined) return { error: "カテゴリの登録に失敗しました" };

  if (preset) {
    const categoryId = id;
    await db.insert(specFields).values(
      preset.fields.map((f, i) => ({
        categoryId,
        name: f.name,
        unit: f.unit ?? null,
        kind: f.kind,
        better: f.better,
        scoreWeight: f.scoreWeight ?? 0,
        position: i,
      })),
    );
  }

  revalidatePath("/");
  redirect(`/categories/${id}`);
}

export async function renameCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = parseForm(
    z.object({ id: idFromForm, name: nameSchema }),
    formData,
  );
  if (!parsed.ok) return { error: parsed.error };

  const db = await getDb();
  try {
    await db
      .update(categories)
      .set({ name: parsed.data.name })
      .where(eq(categories.id, parsed.data.id));
  } catch (e) {
    if (isUniqueViolation(e))
      return { error: `「${parsed.data.name}」は既に存在します` };
    throw e;
  }
  revalidatePath("/");
  revalidatePath(`/categories/${parsed.data.id}`, "layout");
  return { success: "変更しました" };
}

/** 比較表を開いたときに出すコスパ列の項目を決める。空なら出さない */
export async function setDefaultCostField(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = parseForm(
    z.object({ id: idFromForm, fieldId: optionalIdFromForm }),
    formData,
  );
  if (!parsed.ok) return { error: parsed.error };

  const db = await getDb();
  const fieldId = parsed.data.fieldId ?? null;
  if (fieldId !== null) {
    // 別のカテゴリの項目や、コスパにならない項目を選ばせない
    const field = (
      await db
        .select()
        .from(specFields)
        .where(
          and(
            eq(specFields.id, fieldId),
            eq(specFields.categoryId, parsed.data.id),
          ),
        )
        .limit(1)
    )[0];
    if (!field || !isCostField(field))
      return { error: "コスパに使えるのは、大きいほど良い数値の項目だけです" };
  }

  await db
    .update(categories)
    .set({ defaultCostFieldId: fieldId })
    .where(eq(categories.id, parsed.data.id));
  revalidatePath(`/categories/${parsed.data.id}`, "layout");
  return { success: "変更しました" };
}

/** 重みの入力。空欄は 0（スコアに入れない）として扱う */
const weightFromForm = z.preprocess(
  (v) =>
    v === undefined || (typeof v === "string" && v.trim() === "") ? 0 : v,
  z.coerce
    .number()
    .int("重みは整数で入力してください")
    .min(0, "重みは 0〜10 で入力してください")
    .max(10, "重みは 0〜10 で入力してください"),
);

/**
 * 総合スコアの重みを保存する。価格は w_price、項目は w_<id>。
 * 項目はこのカテゴリの比べられる項目から読む。送られてきた id をそのまま信じない
 */
export async function setScoreWeights(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = parseForm(
    z.object({ id: idFromForm, w_price: weightFromForm }),
    formData,
  );
  if (!parsed.ok) return { error: parsed.error };
  const categoryId = parsed.data.id;

  const db = await getDb();
  const fields = (await listFields(db, categoryId)).filter(isRankable);
  const fieldWeights: { id: number; weight: number }[] = [];
  for (const field of fields) {
    const weight = weightFromForm.safeParse(
      formData.get(`w_${field.id}`) ?? undefined,
    );
    if (!weight.success)
      return { error: `${field.name}: ${weight.error.issues[0]?.message}` };
    fieldWeights.push({ id: field.id, weight: weight.data });
  }

  await db.batch([
    db
      .update(categories)
      .set({ priceScoreWeight: parsed.data.w_price })
      .where(eq(categories.id, categoryId)),
    ...fieldWeights.map((f) =>
      db
        .update(specFields)
        .set({ scoreWeight: f.weight })
        .where(
          and(eq(specFields.id, f.id), eq(specFields.categoryId, categoryId)),
        ),
    ),
  ]);
  revalidatePath(`/categories/${categoryId}`, "layout");
  return { success: "変更しました" };
}

/**
 * カテゴリを消す。商品が残っているカテゴリは消さない。
 * 商品ごと消すと画像や価格の記録まで一度に失うので、商品を先に消してもらう
 */
export async function deleteCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = parseForm(z.object({ id: idFromForm }), formData);
  if (!parsed.ok) return { error: parsed.error };

  const db = await getDb();
  const [{ n }] = await db
    .select({ n: count() })
    .from(products)
    .where(eq(products.categoryId, parsed.data.id));
  if (n > 0)
    return { error: `商品が ${n} 件残っています。先に商品を削除してください` };

  // スペック項目は ON DELETE CASCADE で一緒に消える
  await db.delete(categories).where(eq(categories.id, parsed.data.id));
  revalidatePath("/");
  redirect("/");
}
