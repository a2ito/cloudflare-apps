import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  picture: text("picture"),
  createdAt: integer("created_at").notNull(),
});

export const exams = sqliteTable("exams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
});

/** 大分類 */
export const groups = sqliteTable("groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  examId: integer("exam_id").notNull(),
  name: text("name").notNull(),
});

/** 小分類 */
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull(),
  name: text("name").notNull(),
});

/**
 * 試験回（試験日程）
 * 例：2025年 春期 基本情報技術者試験
 */
export const examSessions = sqliteTable("exam_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  examId: integer("exam_id").notNull(), // 資格ID

  name: text("name").notNull(),
  // 例: "2025年 春期"

  note: text("note"),
});

export const questions = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id").notNull(),
  examId: integer("exam_id").notNull().default(1),
  examSessionId: integer("exam_session_id").notNull().default(1),
  title: text("title").notNull(),
  body: text("body").notNull(),
  explanation: text("explanation"),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const choices = sqliteTable("choices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  questionId: integer("question_id").notNull(),
  text: text("text").notNull(),
  isCorrect: integer("is_correct").notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  questions: many(questions),
}));

export const examsRelations = relations(exams, ({ many }) => ({
  groups: many(groups),
  examSessions: many(examSessions),
  questions: many(questions),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  exam: one(exams, {
    fields: [groups.examId],
    references: [exams.id],
  }),
  categories: many(categories),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  group: one(groups, {
    fields: [categories.groupId],
    references: [groups.id],
  }),
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  category: one(categories, {
    fields: [questions.categoryId],
    references: [categories.id],
  }),
  exam: one(exams, {
    fields: [questions.examId],
    references: [exams.id],
  }),
  examSession: one(examSessions, {
    fields: [questions.examSessionId],
    references: [examSessions.id],
  }),
  createdByUser: one(users, {
    fields: [questions.createdBy],
    references: [users.id],
  }),
  choices: many(choices),
}));

export const examSessionsRelations = relations(
  examSessions,
  ({ one, many }) => ({
    exam: one(exams, {
      fields: [examSessions.examId],
      references: [exams.id],
    }),
    questions: many(questions),
  }),
);

export const choicesRelations = relations(choices, ({ one }) => ({
  question: one(questions, {
    fields: [choices.questionId],
    references: [questions.id],
  }),
}));
