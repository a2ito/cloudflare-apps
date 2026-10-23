"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  addMenuItem,
  createExercise,
  createMenu,
  deleteExercise,
  deleteMenu,
  removeMenuItem,
  updateExercise,
} from "@/db/queries";
import { requireUser } from "@/lib/auth";
import {
  type ActionState,
  idFromForm,
  numberField,
  parseForm,
} from "@/lib/form";
import {
  MAX_INCREMENT,
  MAX_REPS,
  MAX_SETS,
  MAX_WEIGHT,
  WEIGHT_STEP,
} from "@/lib/limits";
import { isWeight } from "@/lib/workout-form";

const exerciseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "種目名を入力してください")
    .max(50, "種目名が長すぎます"),
  targetSets: numberField("セット数", (n) =>
    n
      .int("セット数は整数で入力してください")
      .min(1, "セット数は 1 以上で入力してください")
      .max(MAX_SETS, `セット数は ${MAX_SETS} 以下で入力してください`),
  ),
  targetReps: numberField("回数", (n) =>
    n
      .int("回数は整数で入力してください")
      .min(1, "回数は 1 以上で入力してください")
      .max(MAX_REPS, `回数は ${MAX_REPS} 以下で入力してください`),
  ),
  weight: numberField("重量", (n) =>
    n.refine(
      isWeight,
      `重量は 0〜${MAX_WEIGHT}kg を ${WEIGHT_STEP}kg 刻みで入力してください`,
    ),
  ),
  increment: numberField("上げ幅", (n) =>
    n.refine(
      (v) => isWeight(v) && v <= MAX_INCREMENT,
      `上げ幅は 0〜${MAX_INCREMENT}kg を ${WEIGHT_STEP}kg 刻みで入力してください`,
    ),
  ),
});

const menuSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "メニュー名を入力してください")
    .max(30, "メニュー名が長すぎます"),
});

const menuItemSchema = z.object({ menuId: idFromForm, exerciseId: idFromForm });

/** 目標を変えると今日のメニューの予定も変わるため、両方の画面を作り直す */
function revalidate() {
  revalidatePath("/plan");
  revalidatePath("/");
}

export async function addExercise(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(exerciseSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const db = await getDb();
  await createExercise(db, user.id, parsed.data);
  revalidate();
  return { success: `${parsed.data.name} を追加しました` };
}

export async function updateExerciseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = idFromForm.safeParse(formData.get("id"));
  if (!id.success) return { error: "ID が不正です" };
  const parsed = parseForm(exerciseSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const db = await getDb();
  if (!(await updateExercise(db, user.id, id.data, parsed.data)))
    return { error: "種目が見つかりません" };
  revalidate();
  return { success: `${parsed.data.name} を更新しました` };
}

export async function deleteExerciseAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idFromForm.safeParse(formData.get("id"));
  if (!id.success) throw new Error("ID が不正です");

  const db = await getDb();
  await deleteExercise(db, user.id, id.data);
  revalidate();
}

export async function addMenu(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(menuSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const db = await getDb();
  await createMenu(db, user.id, parsed.data.name);
  revalidate();
  return { success: `${parsed.data.name} を追加しました` };
}

export async function deleteMenuAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idFromForm.safeParse(formData.get("id"));
  if (!id.success) throw new Error("ID が不正です");

  const db = await getDb();
  await deleteMenu(db, user.id, id.data);
  revalidate();
}

export async function addMenuItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(menuItemSchema, formData);
  if (!parsed.ok) return { error: "種目を選んでください" };

  const db = await getDb();
  if (
    !(await addMenuItem(
      db,
      user.id,
      parsed.data.menuId,
      parsed.data.exerciseId,
    ))
  ) {
    return { error: "この種目はすでに入っています" };
  }
  revalidate();
  return { success: "種目を入れました" };
}

export async function removeMenuItemAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idFromForm.safeParse(formData.get("id"));
  if (!id.success) throw new Error("ID が不正です");

  const db = await getDb();
  await removeMenuItem(db, user.id, id.data);
  revalidate();
}
