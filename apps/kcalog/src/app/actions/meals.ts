"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { createMeal, deleteMeal } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { isDate } from "@/lib/date";
import { type ActionState, idFromForm, parseForm } from "@/lib/form";
import { MAX_KCAL } from "@/lib/limits";

const mealSchema = z.object({
  eatenOn: z.string().refine(isDate, "日付の形式が不正です"),
  foodName: z
    .string()
    .trim()
    .min(1, "食品名を入力してください")
    .max(100, "食品名が長すぎます"),
  kcal: z.coerce
    .number({ error: "カロリーは数値で入力してください" })
    .int("カロリーは整数で入力してください")
    .min(0, "カロリーは 0 以上で入力してください")
    .max(MAX_KCAL, `カロリーは ${MAX_KCAL} 以下で入力してください`),
});

export async function addMeal(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  // 空欄は coerce で 0 になり「0 kcal」として通ってしまうため、先に弾く
  if (String(formData.get("kcal") ?? "").trim() === "")
    return { error: "カロリーを入力してください" };
  const parsed = parseForm(mealSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const db = await getDb();
  await createMeal(db, user.id, parsed.data);
  revalidatePath("/");
  return { success: `${parsed.data.foodName} を記録しました` };
}

export async function deleteMealAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idFromForm.safeParse(formData.get("id"));
  if (!id.success) throw new Error("ID が不正です");

  const db = await getDb();
  await deleteMeal(db, user.id, id.data);
  revalidatePath("/");
}
