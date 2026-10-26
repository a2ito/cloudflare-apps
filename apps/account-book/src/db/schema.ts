import {
  sqliteTable,
  integer,
  text,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
});

export const expenses = sqliteTable(
  "expenses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id),

    amount: integer("amount").notNull(),
    categoryId: text("category_id"),
    memo: text("memo"),
    date: text("date").notNull(), // yyyy-mm-dd
    // サブスクから自動計上した明細だけが持つ。同じ請求日の二重計上を防ぐ
    subscriptionId: integer("subscription_id"),
    // レシート画像の R2 キー。1 明細に 1 枚まで
    receiptKey: text("receipt_key"),

    //createdAt: integer("created_at").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    subscriptionDateUnique: uniqueIndex(
      "expenses_subscription_id_date_unique",
    ).on(t.subscriptionId, t.date),
  }),
);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  //createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const userGroups = sqliteTable(
  "user_groups",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.groupId] }),
  }),
);

export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id),
    name: text("name").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    // 同一グループ内でのタグ名重複を禁止
    nameUnique: uniqueIndex("tags_group_id_name_unique").on(t.groupId, t.name),
  }),
);

export const expenseTags = sqliteTable(
  "expense_tags",
  {
    expenseId: integer("expense_id")
      .notNull()
      .references(() => expenses.id),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.expenseId, t.tagId] }),
  }),
);

export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  categoryId: text("category_id").notNull(),
  cycle: text("cycle", { enum: ["monthly", "yearly"] }).notNull(),
  // 請求日。月末より大きい日は月末に寄せる
  billingDay: integer("billing_day").notNull(),
  // 年額のときだけ使う請求月（1〜12）
  billingMonth: integer("billing_month"),
  startDate: text("start_date").notNull(), // yyyy-mm-dd
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});
