import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
// drizzle-kit が読むファイルなので、tsconfig の paths（@/）に頼らず相対で読む
import { GENDERS, MEMBER_ROLES } from "../lib/constants";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

/** ログインした Google アカウント */
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

/** 家系図 1 枚。1 人が何枚でも持てる（父方・母方を分けるなど） */
export const trees = sqliteTable("trees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(now),
});

/**
 * 家系図を見られる・直せる人。
 *
 * users の id ではなくメールで持つ。共有したい相手がまだ一度もログインしていなくても
 * 先に登録しておけるようにするため（ログインできるかは ALLOWED_EMAILS が決める）。
 */
export const treeMembers = sqliteTable(
  "tree_members",
  {
    treeId: integer("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    /** 小文字に揃えて持つ */
    email: text("email").notNull(),
    role: text("role", { enum: MEMBER_ROLES }).notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    primaryKey({ columns: [t.treeId, t.email] }),
    index("tree_members_email_idx").on(t.email),
  ],
);

/** 家系図に載る人物 */
export const persons = sqliteTable(
  "persons",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    treeId: integer("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kana: text("kana"),
    gender: text("gender", { enum: GENDERS }).notNull().default("unknown"),
    /** "1950" / "1950-04" / "1950-04-01"。昔の人ほど年しか分からないため、粒度は問わない */
    birthDate: text("birth_date"),
    deathDate: text("death_date"),
    note: text("note"),
    createdAt: text("created_at").notNull().default(now),
  },
  // つながりの表が (tree_id, id) を外部キーで指すために一意にしておく
  (t) => [uniqueIndex("persons_tree_id_idx").on(t.treeId, t.id)],
);

/**
 * つながりの両端が、つながりと同じ家系図の人物であることを DB でも保証する。
 * アプリでも確かめているが、確認を忘れたクエリが増えても別の家系図の人物と結べないように
 */
const samePerson = (treeId: AnySQLiteColumn, personId: AnySQLiteColumn) =>
  foreignKey({
    columns: [treeId, personId],
    foreignColumns: [persons.treeId, persons.id],
  }).onDelete("cascade");

/** 親子。子 1 人につき親は 2 人まで（アプリ側で確かめる） */
export const parentChild = sqliteTable(
  "parent_child",
  {
    treeId: integer("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    parentId: integer("parent_id").notNull(),
    childId: integer("child_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.parentId, t.childId] }),
    samePerson(t.treeId, t.parentId),
    samePerson(t.treeId, t.childId),
    index("parent_child_tree_idx").on(t.treeId),
    check("parent_child_not_self", sql`${t.parentId} <> ${t.childId}`),
  ],
);

/**
 * 配偶者。再婚もあるので 1 人が何人とでも結べる。
 * 同じ 2 人を二重に結ばないよう、id の小さい方を person_a に入れる。
 */
export const partnerships = sqliteTable(
  "partnerships",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    treeId: integer("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    personAId: integer("person_a_id").notNull(),
    personBId: integer("person_b_id").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("partnerships_pair_idx").on(t.personAId, t.personBId),
    samePerson(t.treeId, t.personAId),
    samePerson(t.treeId, t.personBId),
    index("partnerships_tree_idx").on(t.treeId),
    check("partnerships_ordered", sql`${t.personAId} < ${t.personBId}`),
  ],
);

export type User = typeof users.$inferSelect;
export type Tree = typeof trees.$inferSelect;
export type TreeMember = typeof treeMembers.$inferSelect;
export type Person = typeof persons.$inferSelect;
export type ParentChild = typeof parentChild.$inferSelect;
export type Partnership = typeof partnerships.$inferSelect;
