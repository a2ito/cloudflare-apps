import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

/** ログインした Google アカウント。セットと文の持ち主 */
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

/** 文をまとめるセット（教材の章など）。練習はセット単位でも全体でもできる */
export const decks = sqliteTable(
  "decks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("decks_user_name_idx").on(t.userId, t.name)],
);

/**
 * 日本文と英文の組。出題の状態（次に出す日・連続正解数）も同じ行に持つ。
 * 1 人で使うので、練習の履歴を別テーブルに残すほどの用途は無い。
 */
export const sentences = sqliteTable(
  "sentences",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deckId: integer("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    ja: text("ja").notNull(),
    en: text("en").notNull(),
    /** 文法のポイントなど。答えと一緒に出す */
    note: text("note"),
    /** 次に出す日（"2026-10-12"）。この日を過ぎた文から優先して出す */
    dueOn: text("due_on").notNull(),
    /** 連続で○だった回数。次に出すまでの間隔を決める。×で 0 に戻る */
    streak: integer("streak").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    wrongCount: integer("wrong_count").notNull().default(0),
    lastReviewedOn: text("last_reviewed_on"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    index("sentences_user_deck_idx").on(t.userId, t.deckId),
    index("sentences_user_due_idx").on(t.userId, t.dueOn),
  ],
);

export type User = typeof users.$inferSelect;
export type Deck = typeof decks.$inferSelect;
export type Sentence = typeof sentences.$inferSelect;
