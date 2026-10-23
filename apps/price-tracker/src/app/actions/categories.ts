"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { categories } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/errors";
import { idFromForm, parseForm, type ActionState } from "@/lib/form";

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
  const parsed = parseForm(z.object({ name: nameSchema }), formData);
  if (!parsed.ok) return { error: parsed.error };

  const db = await getDb();
  try {
    await db.insert(categories).values({ name: parsed.data.name });
  } catch (e) {
    if (isUniqueViolation(e))
      return { error: `「${parsed.data.name}」は既に存在します` };
    throw e;
  }
  revalidatePath("/categories");
  return { success: `「${parsed.data.name}」を追加しました` };
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
  revalidatePath("/categories");
  revalidatePath("/");
  return { success: "変更しました" };
}

export async function deleteCategory(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = parseForm(z.object({ id: idFromForm }), formData);
  if (!parsed.ok) throw new Error(parsed.error);

  const db = await getDb();
  // products.category_id は ON DELETE SET NULL なので商品は残る
  await db.delete(categories).where(eq(categories.id, parsed.data.id));
  revalidatePath("/categories");
  revalidatePath("/");
}
