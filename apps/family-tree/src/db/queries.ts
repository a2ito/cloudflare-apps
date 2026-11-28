import { and, asc, count, eq, sql } from "drizzle-orm";
import type { MemberRole } from "@/lib/constants";
import { MAX_PARENTS, orderPair } from "@/lib/relations";
import type { Db } from "./index";
import {
  parentChild,
  partnerships,
  persons,
  treeMembers,
  trees,
  users,
  type ParentChild,
  type Partnership,
  type Person,
  type Tree,
  type TreeMember,
  type User,
} from "./schema";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/* ── users ─────────────────────────────────────────────────── */

export async function upsertUser(
  db: Db,
  profile: { email: string; name: string | null; image: string | null },
): Promise<User> {
  const email = normalizeEmail(profile.email);
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

/* ── trees / members ───────────────────────────────────────── */

export type TreeSummary = Tree & { role: MemberRole; personCount: number };

/** 自分がメンバーになっている家系図を、作った順に返す */
export async function listTreesFor(
  db: Db,
  email: string,
): Promise<TreeSummary[]> {
  // 人数は 1 本のクエリで数える。家系図の id を inArray で渡すと、D1 の 1 文 100 バインドの上限に当たりうる
  const rows = await db
    .select({
      tree: trees,
      role: treeMembers.role,
      personCount: count(persons.id),
    })
    .from(treeMembers)
    .innerJoin(trees, eq(trees.id, treeMembers.treeId))
    .leftJoin(persons, eq(persons.treeId, trees.id))
    .where(eq(treeMembers.email, normalizeEmail(email)))
    .groupBy(trees.id, treeMembers.role)
    .orderBy(asc(trees.id));
  return rows.map((r) => ({
    ...r.tree,
    role: r.role,
    personCount: r.personCount,
  }));
}

/** 家系図を作り、作った人を持ち主として登録する */
export async function createTree(
  db: Db,
  ownerEmail: string,
  name: string,
): Promise<Tree> {
  // 持ち主の居ない家系図が残らないよう 1 つの batch（トランザクション）で入れる。
  // batch の中は順に流れるので、last_insert_rowid() は直前に作った家系図の id になる
  const [[tree]] = await db.batch([
    db.insert(trees).values({ name }).returning(),
    db.insert(treeMembers).values({
      treeId: sql`last_insert_rowid()`,
      email: normalizeEmail(ownerEmail),
      role: "owner",
    }),
  ]);
  if (!tree) throw new Error("家系図の作成に失敗しました");
  return tree;
}

/**
 * メンバーとしての権限を返す。メンバーでなければ null。
 * 家系図の中身に触る前に必ずここを通す（他人の家系図の ID を送られても読ませない）。
 */
export async function getMembership(
  db: Db,
  treeId: number,
  email: string,
): Promise<{ tree: Tree; role: MemberRole } | null> {
  const [row] = await db
    .select({ tree: trees, role: treeMembers.role })
    .from(treeMembers)
    .innerJoin(trees, eq(trees.id, treeMembers.treeId))
    .where(
      and(
        eq(treeMembers.treeId, treeId),
        eq(treeMembers.email, normalizeEmail(email)),
      ),
    );
  return row ?? null;
}

export async function renameTree(
  db: Db,
  treeId: number,
  name: string,
): Promise<void> {
  await db.update(trees).set({ name }).where(eq(trees.id, treeId));
}

/** 人物・つながり・メンバーは外部キーの cascade で一緒に消える */
export async function deleteTree(db: Db, treeId: number): Promise<void> {
  await db.delete(trees).where(eq(trees.id, treeId));
}

export async function listMembers(
  db: Db,
  treeId: number,
): Promise<TreeMember[]> {
  return db
    .select()
    .from(treeMembers)
    .where(eq(treeMembers.treeId, treeId))
    .orderBy(asc(treeMembers.createdAt), asc(treeMembers.email));
}

export async function countMembers(db: Db, treeId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(treeMembers)
    .where(eq(treeMembers.treeId, treeId));
  return row?.n ?? 0;
}

/** 追加できたら true。すでにメンバーなら何もせず false */
export async function addMember(
  db: Db,
  treeId: number,
  email: string,
): Promise<boolean> {
  const inserted = await db
    .insert(treeMembers)
    .values({ treeId, email: normalizeEmail(email), role: "editor" })
    .onConflictDoNothing()
    .returning({ email: treeMembers.email });
  return inserted.length > 0;
}

/** 編集者だけを外す。持ち主は外せない（家系図ごと消すしかない） */
export async function removeEditor(
  db: Db,
  treeId: number,
  email: string,
): Promise<boolean> {
  const deleted = await db
    .delete(treeMembers)
    .where(
      and(
        eq(treeMembers.treeId, treeId),
        eq(treeMembers.email, normalizeEmail(email)),
        eq(treeMembers.role, "editor"),
      ),
    )
    .returning({ email: treeMembers.email });
  return deleted.length > 0;
}

/* ── persons / relations ───────────────────────────────────── */

export type PersonInput = {
  name: string;
  kana: string | null;
  gender: Person["gender"];
  birthDate: string | null;
  deathDate: string | null;
  note: string | null;
};

export type FamilyGraph = {
  persons: Person[];
  parents: ParentChild[];
  partners: Partnership[];
};

/** 家系図 1 枚ぶんの人物とつながりをまとめて読む */
export async function loadFamily(db: Db, treeId: number): Promise<FamilyGraph> {
  const [ps, pcs, pts] = await db.batch([
    db
      .select()
      .from(persons)
      .where(eq(persons.treeId, treeId))
      .orderBy(asc(persons.id)),
    db.select().from(parentChild).where(eq(parentChild.treeId, treeId)),
    db.select().from(partnerships).where(eq(partnerships.treeId, treeId)),
  ]);
  return { persons: ps, parents: pcs, partners: pts };
}

export async function countPersons(db: Db, treeId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(persons)
    .where(eq(persons.treeId, treeId));
  return row?.n ?? 0;
}

/** 家系図に属する人物だけを返す。別の家系図の人物の ID なら null */
export async function findPerson(
  db: Db,
  treeId: number,
  personId: number,
): Promise<Person | null> {
  const [row] = await db
    .select()
    .from(persons)
    .where(and(eq(persons.id, personId), eq(persons.treeId, treeId)));
  return row ?? null;
}

export async function createPerson(
  db: Db,
  treeId: number,
  input: PersonInput,
): Promise<Person> {
  const [row] = await db
    .insert(persons)
    .values({ treeId, ...input })
    .returning();
  if (!row) throw new Error("人物の保存に失敗しました");
  return row;
}

export type RelativeKind = "parent" | "child" | "partner";

/**
 * 新しい人物を作り、既存の人物（relativeOf）とつなぐ。kind は新しい人物から見た続柄。
 * つながりの無い人物が残らないよう 1 つの batch（トランザクション）で入れる。
 *
 * 親として足すときは、同時に別の人が親を足していても 3 人目にならないよう、batch の中で
 * 人数を確かめる。超えていたら作った人物も消して null を返す。
 */
export async function createRelative(
  db: Db,
  treeId: number,
  relativeOf: number,
  kind: RelativeKind,
  input: PersonInput,
): Promise<Person | null> {
  if (kind === "parent") {
    // 条件付きの INSERT は drizzle の batch に混ぜられない（生の SQL を渡すと落ちる）ので、D1 の batch を直接使う
    const d1 = db.$client;
    // batch の中なので、この家系図で一番大きい id がいま作った人物になる
    const newest = "(SELECT max(id) FROM persons WHERE tree_id = ?1)";
    const [inserted] = await d1.batch([
      d1
        .prepare(
          `INSERT INTO persons (tree_id, name, kana, gender, birth_date, death_date, note)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING id`,
        )
        .bind(
          treeId,
          input.name,
          input.kana,
          input.gender,
          input.birthDate,
          input.deathDate,
          input.note,
        ),
      d1
        .prepare(
          `INSERT INTO parent_child (tree_id, parent_id, child_id)
           SELECT ?1, last_insert_rowid(), ?2
           WHERE (SELECT count(*) FROM parent_child WHERE child_id = ?2) < ?3`,
        )
        .bind(treeId, relativeOf, MAX_PARENTS),
      d1
        .prepare(
          `DELETE FROM persons WHERE id = ${newest}
           AND NOT EXISTS (SELECT 1 FROM parent_child WHERE parent_id = ${newest})`,
        )
        .bind(treeId),
    ]);
    const row: unknown = inserted?.results[0];
    if (
      typeof row !== "object" ||
      row === null ||
      !("id" in row) ||
      typeof row.id !== "number"
    )
      throw new Error("人物の保存に失敗しました");
    return findPerson(db, treeId, row.id);
  }

  const created = sql`last_insert_rowid()`;
  const link =
    kind === "partner"
      ? // 新しい人物の id は既存の人物より必ず大きいので、既存の方を person_a に入れれば順序が保てる
        db
          .insert(partnerships)
          .values({ treeId, personAId: relativeOf, personBId: created })
      : db
          .insert(parentChild)
          .values({ treeId, parentId: relativeOf, childId: created });
  const [[row]] = await db.batch([
    db
      .insert(persons)
      .values({ treeId, ...input })
      .returning(),
    link,
  ]);
  if (!row) throw new Error("人物の保存に失敗しました");
  return row;
}

export async function updatePerson(
  db: Db,
  treeId: number,
  personId: number,
  input: PersonInput,
): Promise<boolean> {
  const updated = await db
    .update(persons)
    .set(input)
    .where(and(eq(persons.id, personId), eq(persons.treeId, treeId)))
    .returning({ id: persons.id });
  return updated.length > 0;
}

/** つながりは外部キーの cascade で一緒に消える */
export async function deletePerson(
  db: Db,
  treeId: number,
  personId: number,
): Promise<boolean> {
  const deleted = await db
    .delete(persons)
    .where(and(eq(persons.id, personId), eq(persons.treeId, treeId)))
    .returning({ id: persons.id });
  return deleted.length > 0;
}

export type LinkResult = "added" | "duplicate" | "too_many_parents";

/**
 * 親子をつなぐ。
 *
 * 呼ぶ側は先に relations.ts で確かめているが、2 人が同時に操作すると確かめた時点の状態が古くなる。
 * 親の人数と重複だけは INSERT の中でも確かめ、3 人目の親や二重のつながりができないようにする
 * （一周しないかどうかは SQL では確かめられないので、アプリ側の確認だけに頼る）。
 */
export async function addParentLink(
  db: Db,
  treeId: number,
  parentId: number,
  childId: number,
): Promise<LinkResult> {
  const result = await db.run(sql`
    INSERT INTO parent_child (tree_id, parent_id, child_id)
    SELECT ${treeId}, ${parentId}, ${childId}
    WHERE (SELECT count(*) FROM parent_child WHERE child_id = ${childId}) < ${MAX_PARENTS}
    ON CONFLICT DO NOTHING
  `);
  if (result.meta.changes > 0) return "added";
  const [existing] = await db
    .select({ childId: parentChild.childId })
    .from(parentChild)
    .where(
      and(eq(parentChild.parentId, parentId), eq(parentChild.childId, childId)),
    );
  return existing ? "duplicate" : "too_many_parents";
}

export async function removeParentLink(
  db: Db,
  treeId: number,
  parentId: number,
  childId: number,
): Promise<boolean> {
  const deleted = await db
    .delete(parentChild)
    .where(
      and(
        eq(parentChild.treeId, treeId),
        eq(parentChild.parentId, parentId),
        eq(parentChild.childId, childId),
      ),
    )
    .returning({ parentId: parentChild.parentId });
  return deleted.length > 0;
}

export async function addPartnerLink(
  db: Db,
  treeId: number,
  a: number,
  b: number,
): Promise<Exclude<LinkResult, "too_many_parents">> {
  const [personAId, personBId] = orderPair(a, b);
  // 同時に同じ 2 人を結ばれても、一意インデックスの違反で落とさずに重複として返す
  const inserted = await db
    .insert(partnerships)
    .values({ treeId, personAId, personBId })
    .onConflictDoNothing()
    .returning({ id: partnerships.id });
  return inserted.length > 0 ? "added" : "duplicate";
}

export async function removePartnerLink(
  db: Db,
  treeId: number,
  a: number,
  b: number,
): Promise<boolean> {
  const [personAId, personBId] = orderPair(a, b);
  const deleted = await db
    .delete(partnerships)
    .where(
      and(
        eq(partnerships.treeId, treeId),
        eq(partnerships.personAId, personAId),
        eq(partnerships.personBId, personBId),
      ),
    )
    .returning({ id: partnerships.id });
  return deleted.length > 0;
}
