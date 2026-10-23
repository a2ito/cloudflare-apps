import { sql } from "drizzle-orm";
import {
  index,
  integer,
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
 * 食べたもの 1 件。
 *
 * 摂取量は人ごとに見るものなので、記録は持ち主にしか見せない（user_id で絞る）。
 */
export const meals = sqliteTable(
  "meals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 食べた日（"2026-09-25"）。1 日の合計を出す単位 */
    eatenOn: text("eaten_on").notNull(),
    foodName: text("food_name").notNull(),
    /** 小数まで気にする場面は無いので整数で持つ */
    kcal: integer("kcal").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("meals_user_eaten_on_idx").on(t.userId, t.eatenOn)],
);

export type User = typeof users.$inferSelect;
export type Meal = typeof meals.$inferSelect;
