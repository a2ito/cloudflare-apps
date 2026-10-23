import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

/** ログインした Google アカウント。記録の持ち主 */
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    name: text("name"),
    image: text("image"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

/**
 * 種目と、その目標。
 *
 * 重量はメニューではなく種目に持たせる。スクワットを A と B の両方に入れたとき、
 * どちらの日にやっても同じ重量から続けられるようにするため。
 */
export const exercises = sqliteTable(
  "exercises",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetSets: integer("target_sets").notNull(),
    targetReps: integer("target_reps").notNull(),
    /** 次回に提案する重量（kg）。記録を保存したとき、目標に届いていれば上げ幅だけ増える */
    weight: real("weight").notNull(),
    /** 1 回に上げる重量（kg）。0 なら自動では上げない（自重種目など） */
    increment: real("increment").notNull().default(2.5),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("exercises_user_idx").on(t.userId)],
);

/** メニュー（A・B・C…）。作った順（id 順）に回す */
export const menus = sqliteTable(
  "menus",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("menus_user_idx").on(t.userId)],
);

/** メニューに入れた種目。入れた順（id 順）に並べる */
export const menuItems = sqliteTable(
  "menu_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    menuId: integer("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("menu_items_menu_exercise_idx").on(t.menuId, t.exerciseId),
  ],
);

/**
 * 1 回のトレーニング。
 *
 * メニュー名は記録した時点の名前を写しておく。メニューを消しても履歴が読めるようにするため。
 * menu_id は次に回すメニューを決めるのに使う。
 */
export const workouts = sqliteTable(
  "workouts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    menuId: integer("menu_id").references(() => menus.id, {
      onDelete: "set null",
    }),
    menuName: text("menu_name").notNull(),
    /** やった日（"2026-09-25"） */
    performedOn: text("performed_on").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("workouts_user_performed_on_idx").on(t.userId, t.performedOn)],
);

/** 実際にやった 1 セット。種目名もメニュー名と同じ理由で写しておく */
export const workoutSets = sqliteTable(
  "workout_sets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workoutId: integer("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id").references(() => exercises.id, {
      onDelete: "set null",
    }),
    exerciseName: text("exercise_name").notNull(),
    setNumber: integer("set_number").notNull(),
    weight: real("weight").notNull(),
    reps: integer("reps").notNull(),
    /** その日の目標回数。あとから目標を変えても、当時届いていたかを見返せるように残す */
    targetReps: integer("target_reps").notNull(),
  },
  (t) => [index("workout_sets_workout_idx").on(t.workoutId)],
);

export type User = typeof users.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Menu = typeof menus.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutSet = typeof workoutSets.$inferSelect;
