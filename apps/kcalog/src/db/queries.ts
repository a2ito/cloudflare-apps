import { and, asc, eq } from "drizzle-orm";
import type { Db } from "./index";
import { meals, users, type Meal, type User } from "./schema";

/* ── users ─────────────────────────────────────────────────── */

export async function upsertUser(
  db: Db,
  profile: { email: string; name: string | null; image: string | null },
): Promise<User> {
  const email = profile.email.trim().toLowerCase();
  const [row] = await db
    .insert(users)
    .values({ email, name: profile.name, image: profile.image })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: profile.name, image: profile.image },
    })
    .returning();
  if (!row) throw new Error("ユーザの保存に失敗しました");
  return row;
}

/* ── meals ─────────────────────────────────────────────────── */

export type MealInput = { eatenOn: string; foodName: string; kcal: number };

export async function createMeal(
  db: Db,
  userId: number,
  input: MealInput,
): Promise<Meal> {
  const [row] = await db
    .insert(meals)
    .values({ userId, ...input })
    .returning();
  if (!row) throw new Error("記録の保存に失敗しました");
  return row;
}

/** その日の記録を、書いた順に返す */
export async function listMealsOn(
  db: Db,
  userId: number,
  eatenOn: string,
): Promise<Meal[]> {
  return db
    .select()
    .from(meals)
    .where(and(eq(meals.userId, userId), eq(meals.eatenOn, eatenOn)))
    .orderBy(asc(meals.id));
}

/** 持ち主のものだけ消す。他人の記録の ID を送られても何も起きない */
export async function deleteMeal(
  db: Db,
  userId: number,
  id: number,
): Promise<boolean> {
  const deleted = await db
    .delete(meals)
    .where(and(eq(meals.id, id), eq(meals.userId, userId)))
    .returning({ id: meals.id });
  return deleted.length > 0;
}
