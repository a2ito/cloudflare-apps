import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

// グループ（イベント単位）。currency は精算に使う通貨で、作成後は変えない。
export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("JPY"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// メンバー
export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// 立替（支払い）。amount は currency の最小単位(minor units)の整数。
// currency がグループの通貨と違う場合は exchange_rates のレートで換算して精算する。
export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  payerId: text("payer_id")
    .notNull()
    .references(() => members.id, { onDelete: "restrict" }),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("JPY"),
  description: text("description").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// 立替の割り勘対象メンバー。weight の比で負担を分ける（全員同じなら均等割り）。
// weight は倍率を 10 倍した整数（10 = 1 倍、15 = 1.5 倍）。src/lib/weight.ts を参照。
export const expenseParticipants = sqliteTable(
  "expense_participants",
  {
    expenseId: text("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    weight: integer("weight").notNull().default(10),
  },
  (t) => [primaryKey({ columns: [t.expenseId, t.memberId] })],
);

// グループで使う外貨と、その為替レート。行があればその通貨で立替を記録できる。
// rate は外貨 1 単位あたりの精算通貨の額（10 進数の文字列）。取得に失敗した通貨は null。
// 同じ通貨の立替はすべてこのレートで換算するため、変更すると精算結果も変わる。
export const exchangeRates = sqliteTable(
  "exchange_rates",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(),
    rate: text("rate"),
    // "auto" は API から取得、"manual" は手入力
    rateSource: text("rate_source", { enum: ["auto", "manual"] })
      .notNull()
      .default("auto"),
    // 自動取得したレートの基準日 (YYYY-MM-DD)。手入力なら null。
    rateDate: text("rate_date"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.currency] })],
);

export type Group = typeof groups.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseParticipant = typeof expenseParticipants.$inferSelect;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
