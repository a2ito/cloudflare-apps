import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

/** ログインした Google アカウント。日記の持ち主 */
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
 * 日記 1 件。1 日に何件でも書ける。
 *
 * 日記は私的なものなので、持ち主にしか見せない（user_id で絞る）。
 */
export const entries = sqliteTable(
  "entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * 出来事の日時。日本時間の壁時計時刻（"2026-09-25T12:30"）をそのまま持つ。
     * 文字列の並びがそのまま時系列になり、日付で絞るときも先頭 10 文字で済む
     */
    happenedAt: text("happened_at").notNull(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("entries_user_happened_at_idx").on(t.userId, t.happenedAt)],
);

/** 日記に付けた写真。実体は R2 にあり、ここにはキーだけを持つ */
export const entryPhotos = sqliteTable(
  "entry_photos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entryId: integer("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    contentType: text("content_type").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    index("entry_photos_entry_idx").on(t.entryId),
    uniqueIndex("entry_photos_key_idx").on(t.key),
  ],
);

export type User = typeof users.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type EntryPhoto = typeof entryPhotos.$inferSelect;
