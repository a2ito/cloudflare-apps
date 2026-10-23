import { and, asc, eq, sql } from "drizzle-orm";
import { review } from "@/lib/srs";
import type { Db } from "./index";
import {
  decks,
  sentences,
  users,
  type Deck,
  type Sentence,
  type User,
} from "./schema";

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

/* ── decks ─────────────────────────────────────────────────── */

export type DeckWithStats = Deck & { total: number; due: number };

/** セットを名前順に返す。文の数と、今日出す（期限を過ぎた）文の数を添える */
export async function listDecksWithStats(
  db: Db,
  userId: number,
  today: string,
): Promise<DeckWithStats[]> {
  const rows = await db
    .select({
      deck: decks,
      total: sql<number>`count(${sentences.id})`,
      due: sql<number>`coalesce(sum(case when ${sentences.dueOn} <= ${today} then 1 else 0 end), 0)`,
    })
    .from(decks)
    .leftJoin(sentences, eq(sentences.deckId, decks.id))
    .where(eq(decks.userId, userId))
    .groupBy(decks.id)
    .orderBy(asc(decks.name));
  return rows.map((r) => ({ ...r.deck, total: r.total, due: r.due }));
}

export async function getDeck(
  db: Db,
  userId: number,
  id: number,
): Promise<Deck | null> {
  const [row] = await db
    .select()
    .from(decks)
    .where(and(eq(decks.id, id), eq(decks.userId, userId)));
  return row ?? null;
}

/** 同じ名前のセットがあれば null（名前で選ぶので重複させない） */
export async function createDeck(
  db: Db,
  userId: number,
  name: string,
): Promise<Deck | null> {
  const [row] = await db
    .insert(decks)
    .values({ userId, name })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

/** 名前を変える。同じ名前のセットが既にあれば false */
export async function renameDeck(
  db: Db,
  userId: number,
  id: number,
  name: string,
): Promise<boolean> {
  const [dup] = await db
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.userId, userId), eq(decks.name, name)));
  if (dup && dup.id !== id) return false;
  await db
    .update(decks)
    .set({ name })
    .where(and(eq(decks.id, id), eq(decks.userId, userId)));
  return true;
}

/** セットを消す。中の文も一緒に消える（外部キーの cascade） */
export async function deleteDeck(
  db: Db,
  userId: number,
  id: number,
): Promise<boolean> {
  const deleted = await db
    .delete(decks)
    .where(and(eq(decks.id, id), eq(decks.userId, userId)))
    .returning({ id: decks.id });
  return deleted.length > 0;
}

/* ── sentences ─────────────────────────────────────────────── */

export type SentenceInput = { ja: string; en: string; note?: string | null };

/**
 * 文をまとめて足す。新しい文は今日から出題の対象にする。
 * 他人のセットには足せない（セットが見つからなければ 0 件）。
 */
export async function createSentences(
  db: Db,
  userId: number,
  deckId: number,
  inputs: readonly SentenceInput[],
  today: string,
): Promise<number> {
  if (inputs.length === 0) return 0;
  if (!(await getDeck(db, userId, deckId))) return 0;
  // D1 は 1 文のバインド変数が 100 個までなので、行を分けて batch で流す
  const statements = inputs.map((s) =>
    db.insert(sentences).values({
      userId,
      deckId,
      ja: s.ja,
      en: s.en,
      note: s.note ?? null,
      dueOn: today,
    }),
  );
  const [first, ...rest] = statements;
  await db.batch([first, ...rest]);
  return inputs.length;
}

/** セットの文を登録順に返す */
export async function listSentences(
  db: Db,
  userId: number,
  deckId: number,
): Promise<Sentence[]> {
  return db
    .select()
    .from(sentences)
    .where(and(eq(sentences.userId, userId), eq(sentences.deckId, deckId)))
    .orderBy(asc(sentences.id));
}

export async function getSentence(
  db: Db,
  userId: number,
  id: number,
): Promise<Sentence | null> {
  const [row] = await db
    .select()
    .from(sentences)
    .where(and(eq(sentences.id, id), eq(sentences.userId, userId)));
  return row ?? null;
}

/** 文を直す。別のセットへ移すこともできるが、移し先も自分のセットに限る */
export async function updateSentence(
  db: Db,
  userId: number,
  id: number,
  input: SentenceInput & { deckId: number },
): Promise<boolean> {
  if (!(await getDeck(db, userId, input.deckId))) return false;
  const updated = await db
    .update(sentences)
    .set({
      ja: input.ja,
      en: input.en,
      note: input.note ?? null,
      deckId: input.deckId,
    })
    .where(and(eq(sentences.id, id), eq(sentences.userId, userId)))
    .returning({ id: sentences.id });
  return updated.length > 0;
}

export async function deleteSentence(
  db: Db,
  userId: number,
  id: number,
): Promise<boolean> {
  const deleted = await db
    .delete(sentences)
    .where(and(eq(sentences.id, id), eq(sentences.userId, userId)))
    .returning({ id: sentences.id });
  return deleted.length > 0;
}

/* ── practice ──────────────────────────────────────────────── */

export type PracticeSentence = Pick<
  Sentence,
  "id" | "ja" | "en" | "note" | "dueOn" | "wrongCount"
>;

/** 出題の候補。deckId を省くと全セットから */
export async function listPracticeCandidates(
  db: Db,
  userId: number,
  deckId?: number,
): Promise<PracticeSentence[]> {
  return db
    .select({
      id: sentences.id,
      ja: sentences.ja,
      en: sentences.en,
      note: sentences.note,
      dueOn: sentences.dueOn,
      wrongCount: sentences.wrongCount,
    })
    .from(sentences)
    .where(
      deckId === undefined
        ? eq(sentences.userId, userId)
        : and(eq(sentences.userId, userId), eq(sentences.deckId, deckId)),
    );
}

/** ○×を記録し、次に出す日を決め直す。他人の文なら false */
export async function recordReview(
  db: Db,
  userId: number,
  id: number,
  correct: boolean,
  today: string,
): Promise<boolean> {
  const current = await getSentence(db, userId, id);
  if (!current) return false;
  const next = review(current, correct, today);
  await db
    .update(sentences)
    .set(next)
    .where(and(eq(sentences.id, id), eq(sentences.userId, userId)));
  return true;
}
