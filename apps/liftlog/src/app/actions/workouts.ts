"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { deleteWorkout, listMenus, saveWorkout } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { isDate } from "@/lib/date";
import { type ActionState, idFromForm } from "@/lib/form";
import { parseWorkoutSets } from "@/lib/workout-form";

/** 記録すると今日のメニュー・履歴・次回の重量（目標の画面）が変わる */
function revalidate() {
  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/plan");
}

export async function recordWorkout(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const menuId = idFromForm.safeParse(formData.get("menuId"));
  if (!menuId.success) return { error: "メニューが不正です" };
  const performedOn = String(formData.get("performedOn") ?? "");
  if (!isDate(performedOn)) return { error: "日付の形式が不正です" };

  const db = await getDb();
  // 読む欄は、送られてきた欄ではなく DB にあるメニューの中身で決める
  const menu = (await listMenus(db, user.id)).find((m) => m.id === menuId.data);
  if (!menu) return { error: "メニューが見つかりません" };

  const parsed = parseWorkoutSets(formData, menu.exercises);
  if (!parsed.ok) return { error: parsed.error };

  await saveWorkout(db, user.id, {
    menu,
    performedOn,
    entries: parsed.entries,
  });
  revalidate();
  return { success: `${menu.name} を記録しました` };
}

export async function deleteWorkoutAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idFromForm.safeParse(formData.get("id"));
  if (!id.success) throw new Error("ID が不正です");

  const db = await getDb();
  await deleteWorkout(db, user.id, id.data);
  revalidate();
}
