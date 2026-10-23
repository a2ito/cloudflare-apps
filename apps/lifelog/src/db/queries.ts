import { and, asc, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type { StoredPhoto } from "@/lib/photos";
import type { Db } from "./index";
import {
  entries,
  entryPhotos,
  users,
  type Entry,
  type EntryPhoto,
  type User,
} from "./schema";

/*
 * 日記は持ち主にしか見せない。entries を読む・書く・消すクエリは必ず user_id を条件に入れ、
 * 写真は entries と結んで持ち主を確かめる。他人の ID を送られても何も起きないようにする。
 */

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

/* ── entries ───────────────────────────────────────────────── */

export type EntryInput = { happenedAt: string; body: string };
export type EntryWithPhotos = Entry & { photos: EntryPhoto[] };

export async function createEntry(
  db: Db,
  userId: number,
  input: EntryInput,
): Promise<Entry> {
  const [row] = await db
    .insert(entries)
    .values({ userId, ...input })
    .returning();
  if (!row) throw new Error("日記の保存に失敗しました");
  return row;
}

/** 持ち主の日記だけ書き換える。見つからなければ false */
export async function updateEntry(
  db: Db,
  userId: number,
  id: number,
  input: EntryInput,
): Promise<boolean> {
  const updated = await db
    .update(entries)
    .set({ ...input, updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` })
    .where(and(eq(entries.id, id), eq(entries.userId, userId)))
    .returning({ id: entries.id });
  return updated.length > 0;
}

export async function getEntry(
  db: Db,
  userId: number,
  id: number,
): Promise<EntryWithPhotos | null> {
  const [entry] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, id), eq(entries.userId, userId)));
  if (!entry) return null;
  const photos = await db
    .select()
    .from(entryPhotos)
    .where(eq(entryPhotos.entryId, id))
    .orderBy(asc(entryPhotos.id));
  return { ...entry, photos };
}

/** 一覧の続きを読むための位置。同じ時刻の日記がページをまたいでも取りこぼさないよう id も持つ */
export type EntryCursor = { happenedAt: string; id: number };

export function encodeCursor(entry: EntryCursor): string {
  return `${entry.happenedAt}_${entry.id}`;
}

export function decodeCursor(raw: string | undefined): EntryCursor | null {
  const match = raw?.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})_(\d+)$/);
  return match ? { happenedAt: match[1], id: Number(match[2]) } : null;
}

/**
 * 新しい順に limit 件返す。続きがあれば next にカーソルを入れる。
 * 写真は日記ごとにまとめて 1 回で引く（件数分のクエリを投げない）。
 */
export async function listEntries(
  db: Db,
  userId: number,
  { before, limit }: { before?: EntryCursor | null; limit: number },
): Promise<{ entries: EntryWithPhotos[]; next: string | null }> {
  const rows = await db
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        before
          ? or(
              lt(entries.happenedAt, before.happenedAt),
              and(
                eq(entries.happenedAt, before.happenedAt),
                lt(entries.id, before.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(entries.happenedAt), desc(entries.id))
    // 続きがあるかを知るために 1 件多く読む
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const next = rows.length > limit && last ? encodeCursor(last) : null;
  if (page.length === 0) return { entries: [], next };

  const photos = await db
    .select()
    .from(entryPhotos)
    .where(
      inArray(
        entryPhotos.entryId,
        page.map((e) => e.id),
      ),
    )
    .orderBy(asc(entryPhotos.id));
  const byEntry = Map.groupBy(photos, (p) => p.entryId);
  return {
    entries: page.map((e) => ({ ...e, photos: byEntry.get(e.id) ?? [] })),
    next,
  };
}

/**
 * 持ち主の日記を消し、付いていた写真の R2 キーを返す。見つからなければ null。
 * 外部キーの cascade で写真の行は消えるが R2 の実体は残るので、呼び出し側で消す。
 */
export async function deleteEntry(
  db: Db,
  userId: number,
  id: number,
): Promise<string[] | null> {
  const entry = await getEntry(db, userId, id);
  if (!entry) return null;
  await db
    .delete(entries)
    .where(and(eq(entries.id, id), eq(entries.userId, userId)));
  return entry.photos.map((p) => p.key);
}

/* ── photos ────────────────────────────────────────────────── */

export async function addPhotos(
  db: Db,
  entryId: number,
  photos: readonly StoredPhoto[],
): Promise<void> {
  if (photos.length === 0) return;
  await db
    .insert(entryPhotos)
    .values(
      photos.map((p) => ({ entryId, key: p.key, contentType: p.contentType })),
    );
}

/** 持ち主の日記に付いた写真だけ返す */
async function findOwnedPhoto(
  db: Db,
  userId: number,
  condition: ReturnType<typeof eq>,
): Promise<EntryPhoto | null> {
  const [row] = await db
    .select({ photo: entryPhotos })
    .from(entryPhotos)
    .innerJoin(entries, eq(entryPhotos.entryId, entries.id))
    .where(and(condition, eq(entries.userId, userId)));
  return row?.photo ?? null;
}

export function getOwnedPhoto(
  db: Db,
  userId: number,
  id: number,
): Promise<EntryPhoto | null> {
  return findOwnedPhoto(db, userId, eq(entryPhotos.id, id));
}

/** /api/photos で、R2 のキーから持ち主を確かめるのに使う */
export function getOwnedPhotoByKey(
  db: Db,
  userId: number,
  key: string,
): Promise<EntryPhoto | null> {
  return findOwnedPhoto(db, userId, eq(entryPhotos.key, key));
}

export async function deletePhotoRow(db: Db, id: number): Promise<void> {
  await db.delete(entryPhotos).where(eq(entryPhotos.id, id));
}
