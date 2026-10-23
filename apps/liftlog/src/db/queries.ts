import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { nextWeight } from "@/lib/training";
import type { EnteredExercise } from "@/lib/workout-form";
import type { Db } from "./index";
import {
  exercises,
  menuItems,
  menus,
  users,
  workoutSets,
  workouts,
  type Exercise,
  type Menu,
  type User,
  type Workout,
  type WorkoutSet,
} from "./schema";

/*
 * 記録はすべて持ち主にしか見せない。読む・変える・消すクエリは必ず user_id で絞る。
 * user_id を持たない menu_items と workout_sets は、親（menus / workouts）の持ち主で確かめる。
 */

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

/* ── exercises ─────────────────────────────────────────────── */

export type ExerciseInput = Pick<
  Exercise,
  "name" | "targetSets" | "targetReps" | "weight" | "increment"
>;

export async function listExercises(
  db: Db,
  userId: number,
): Promise<Exercise[]> {
  return db
    .select()
    .from(exercises)
    .where(eq(exercises.userId, userId))
    .orderBy(asc(exercises.id));
}

export async function createExercise(
  db: Db,
  userId: number,
  input: ExerciseInput,
): Promise<Exercise> {
  const [row] = await db
    .insert(exercises)
    .values({ userId, ...input })
    .returning();
  if (!row) throw new Error("種目の保存に失敗しました");
  return row;
}

export async function updateExercise(
  db: Db,
  userId: number,
  id: number,
  input: ExerciseInput,
): Promise<boolean> {
  const updated = await db
    .update(exercises)
    .set(input)
    .where(and(eq(exercises.id, id), eq(exercises.userId, userId)))
    .returning({ id: exercises.id });
  return updated.length > 0;
}

export async function deleteExercise(
  db: Db,
  userId: number,
  id: number,
): Promise<boolean> {
  const deleted = await db
    .delete(exercises)
    .where(and(eq(exercises.id, id), eq(exercises.userId, userId)))
    .returning({ id: exercises.id });
  return deleted.length > 0;
}

/* ── menus ─────────────────────────────────────────────────── */

export type MenuWithExercises = Menu & {
  exercises: (Exercise & { itemId: number })[];
};

/** メニューを作った順に、入れた種目を入れた順に並べて返す */
export async function listMenus(
  db: Db,
  userId: number,
): Promise<MenuWithExercises[]> {
  const [menuRows, itemRows] = await Promise.all([
    db
      .select()
      .from(menus)
      .where(eq(menus.userId, userId))
      .orderBy(asc(menus.id)),
    db
      .select({
        itemId: menuItems.id,
        menuId: menuItems.menuId,
        exercise: exercises,
      })
      .from(menuItems)
      .innerJoin(menus, eq(menuItems.menuId, menus.id))
      .innerJoin(exercises, eq(menuItems.exerciseId, exercises.id))
      .where(eq(menus.userId, userId))
      .orderBy(asc(menuItems.id)),
  ]);
  return menuRows.map((menu) => ({
    ...menu,
    exercises: itemRows
      .filter((r) => r.menuId === menu.id)
      .map((r) => ({ ...r.exercise, itemId: r.itemId })),
  }));
}

export async function createMenu(
  db: Db,
  userId: number,
  name: string,
): Promise<Menu> {
  const [row] = await db.insert(menus).values({ userId, name }).returning();
  if (!row) throw new Error("メニューの保存に失敗しました");
  return row;
}

export async function deleteMenu(
  db: Db,
  userId: number,
  id: number,
): Promise<boolean> {
  const deleted = await db
    .delete(menus)
    .where(and(eq(menus.id, id), eq(menus.userId, userId)))
    .returning({ id: menus.id });
  return deleted.length > 0;
}

/** メニューに種目を入れる。どちらかが他人のものなら何もしない。入れ済みなら何もしない */
export async function addMenuItem(
  db: Db,
  userId: number,
  menuId: number,
  exerciseId: number,
): Promise<boolean> {
  const [menu, exercise] = await Promise.all([
    db
      .select({ id: menus.id })
      .from(menus)
      .where(and(eq(menus.id, menuId), eq(menus.userId, userId)))
      .get(),
    db
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(eq(exercises.id, exerciseId), eq(exercises.userId, userId)))
      .get(),
  ]);
  if (!menu || !exercise) return false;
  const inserted = await db
    .insert(menuItems)
    .values({ menuId, exerciseId })
    .onConflictDoNothing()
    .returning();
  return inserted.length > 0;
}

export async function removeMenuItem(
  db: Db,
  userId: number,
  itemId: number,
): Promise<boolean> {
  const owned = db
    .select({ id: menuItems.id })
    .from(menuItems)
    .innerJoin(menus, eq(menuItems.menuId, menus.id))
    .where(and(eq(menuItems.id, itemId), eq(menus.userId, userId)));
  const deleted = await db
    .delete(menuItems)
    .where(inArray(menuItems.id, owned))
    .returning({ id: menuItems.id });
  return deleted.length > 0;
}

/* ── workouts ──────────────────────────────────────────────── */

export type WorkoutWithSets = Workout & { sets: WorkoutSet[] };

/** 直近のトレーニング。次に回すメニューを決めるのに使う */
export async function latestWorkout(
  db: Db,
  userId: number,
): Promise<Workout | undefined> {
  return db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.id))
    .limit(1)
    .get();
}

/**
 * 実績を保存し、目標に届いた種目は次回の重量を上げる。
 *
 * 予定の重量は保存前の種目の値を使う。フォームを開いたあとで目標を書き換えていても、
 * 保存した時点の目標と比べる。
 */
export async function saveWorkout(
  db: Db,
  userId: number,
  input: {
    menu: Pick<Menu, "id" | "name">;
    performedOn: string;
    entries: readonly EnteredExercise[];
  },
): Promise<Workout> {
  const ids = input.entries.map((e) => e.exerciseId);
  const owned = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.userId, userId), inArray(exercises.id, ids)));
  const byId = new Map(owned.map((e) => [e.id, e]));
  const entries = input.entries.flatMap((entry) => {
    const exercise = byId.get(entry.exerciseId);
    return exercise ? [{ exercise, sets: entry.sets }] : [];
  });
  if (entries.length === 0) throw new Error("記録できる種目がありません");

  const [workout] = await db
    .insert(workouts)
    .values({
      userId,
      menuId: input.menu.id,
      menuName: input.menu.name,
      performedOn: input.performedOn,
    })
    .returning();
  if (!workout) throw new Error("記録の保存に失敗しました");

  const setRows = entries.flatMap(({ exercise, sets }) =>
    sets.map((s) => ({
      workoutId: workout.id,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      setNumber: s.setNumber,
      weight: s.weight,
      reps: s.reps,
      targetReps: exercise.targetReps,
    })),
  );
  const weightUpdates = entries
    .map(({ exercise, sets }) => ({
      id: exercise.id,
      from: exercise.weight,
      to: nextWeight(exercise, sets),
    }))
    .filter((u) => u.to !== u.from)
    .map((u) =>
      db.update(exercises).set({ weight: u.to }).where(eq(exercises.id, u.id)),
    );

  // セットの保存と重量の更新は、片方だけ反映されないよう 1 つのバッチで流す。
  // workouts の行は ID を得るため先に入れているので、失敗したら消して空の記録を残さない
  try {
    await db.batch([db.insert(workoutSets).values(setRows), ...weightUpdates]);
  } catch (error) {
    await db.delete(workouts).where(eq(workouts.id, workout.id));
    throw new Error("記録の保存に失敗しました", { cause: error });
  }
  return workout;
}

/** 新しい順に返す。セットは種目を入れた順・セット番号順 */
export async function listWorkouts(
  db: Db,
  userId: number,
  limit: number,
): Promise<WorkoutWithSets[]> {
  const rows = await db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.performedOn), desc(workouts.id))
    .limit(limit);
  return withSets(db, rows);
}

export async function listWorkoutsOn(
  db: Db,
  userId: number,
  performedOn: string,
): Promise<WorkoutWithSets[]> {
  const rows = await db
    .select()
    .from(workouts)
    .where(
      and(eq(workouts.userId, userId), eq(workouts.performedOn, performedOn)),
    )
    .orderBy(asc(workouts.id));
  return withSets(db, rows);
}

async function withSets(db: Db, rows: Workout[]): Promise<WorkoutWithSets[]> {
  if (rows.length === 0) return [];
  const sets = await db
    .select()
    .from(workoutSets)
    .where(
      inArray(
        workoutSets.workoutId,
        rows.map((w) => w.id),
      ),
    )
    .orderBy(asc(workoutSets.id));
  return rows.map((w) => ({
    ...w,
    sets: sets.filter((s) => s.workoutId === w.id),
  }));
}

/** 消しても種目の重量は戻さない。上がった重量が合わなければ目標の画面で直してもらう */
export async function deleteWorkout(
  db: Db,
  userId: number,
  id: number,
): Promise<boolean> {
  const deleted = await db
    .delete(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId)))
    .returning({ id: workouts.id });
  return deleted.length > 0;
}
