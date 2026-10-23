import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { DEFAULT_CURRENCY } from "@/lib/money";
import type { Db } from "./index";
import {
  comments,
  entries,
  entryPhotos,
  tripAreas,
  tripCurrencies,
  trips,
  users,
} from "./schema";
import type {
  Comment,
  Entry,
  EntryPhoto,
  Trip,
  TripArea,
  TripCurrency,
  User,
} from "./schema";

/* ── users ─────────────────────────────────────────────────── */

/** ログインのたびに呼ぶ。表示名・アイコンは最新の Google プロフィールに合わせる */
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

/* ── trips ─────────────────────────────────────────────────── */

/** 旅行と、そこで使う通貨（円以外）。円は主通貨なので常に使える */
export type TripWithCurrencies = Trip & {
  currencies: TripCurrency[];
  areas: TripArea[];
};

export type TripSummary = TripWithCurrencies & {
  entryCount: number;
  /** 記録ごとの金額と通貨。合計の出し方は表示側（lib/money）に任せる */
  amounts: { minor: number; currency: string }[];
};

export async function listTrips(db: Db): Promise<TripSummary[]> {
  const rows = await db
    .select({
      trip: trips,
      entryCount: sql<number>`count(${entries.id})`,
    })
    .from(trips)
    .leftJoin(entries, eq(entries.tripId, trips.id))
    .groupBy(trips.id)
    .orderBy(
      desc(sql`coalesce(${trips.startDate}, ${trips.createdAt})`),
      desc(trips.id),
    );

  const amountRows = await db
    .select({
      tripId: entries.tripId,
      minor: entries.amountMinor,
      currency: entries.amountCurrency,
    })
    .from(entries)
    .where(sql`${entries.amountMinor} is not null`);

  const byTrip = new Map<number, { minor: number; currency: string }[]>();
  for (const row of amountRows) {
    if (row.minor === null) continue;
    const list = byTrip.get(row.tripId) ?? [];
    // 通貨が入っていない古い記録は円で入力されたものとして扱う
    list.push({ minor: row.minor, currency: row.currency ?? DEFAULT_CURRENCY });
    byTrip.set(row.tripId, list);
  }

  const tripIds = rows.map((r) => r.trip.id);
  const [currencies, areas] = await Promise.all([
    listCurrenciesFor(db, tripIds),
    listAreasFor(db, tripIds),
  ]);

  return rows.map((r) => ({
    ...r.trip,
    currencies: currencies.get(r.trip.id) ?? [],
    areas: areas.get(r.trip.id) ?? [],
    entryCount: Number(r.entryCount),
    amounts: byTrip.get(r.trip.id) ?? [],
  }));
}

async function listCurrenciesFor(
  db: Db,
  tripIds: readonly number[],
): Promise<Map<number, TripCurrency[]>> {
  const grouped = new Map<number, TripCurrency[]>();
  if (tripIds.length === 0) return grouped;
  const rows = await db
    .select()
    .from(tripCurrencies)
    .where(inArray(tripCurrencies.tripId, [...tripIds]))
    .orderBy(asc(tripCurrencies.sortOrder), asc(tripCurrencies.id));
  for (const row of rows) {
    const list = grouped.get(row.tripId);
    if (list) list.push(row);
    else grouped.set(row.tripId, [row]);
  }
  return grouped;
}

async function listAreasFor(
  db: Db,
  tripIds: readonly number[],
): Promise<Map<number, TripArea[]>> {
  const grouped = new Map<number, TripArea[]>();
  if (tripIds.length === 0) return grouped;
  const rows = await db
    .select()
    .from(tripAreas)
    .where(inArray(tripAreas.tripId, [...tripIds]))
    .orderBy(asc(tripAreas.sortOrder), asc(tripAreas.id));
  for (const row of rows) {
    const list = grouped.get(row.tripId);
    if (list) list.push(row);
    else grouped.set(row.tripId, [row]);
  }
  return grouped;
}

export async function getTrip(
  db: Db,
  id: number,
): Promise<TripWithCurrencies | null> {
  const [row] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  if (!row) return null;
  const [currencies, areas] = await Promise.all([
    listCurrenciesFor(db, [id]),
    listAreasFor(db, [id]),
  ]);
  return {
    ...row,
    currencies: currencies.get(id) ?? [],
    areas: areas.get(id) ?? [],
  };
}

export type TripCurrencyInput = { code: string; rateToJpy: number };

export type TripInput = {
  name: string;
  startDate?: string;
  endDate?: string;
  /** 円以外に使う通貨。空なら円だけの旅行 */
  currencies: TripCurrencyInput[];
  /** 訪れる場所（ミラノ・ピサなど）。空でもよい */
  areas: string[];
  note?: string;
};

export async function createTrip(
  db: Db,
  input: TripInput,
  createdBy: number,
): Promise<Trip> {
  const [row] = await db
    .insert(trips)
    .values({
      name: input.name,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      note: input.note ?? null,
      createdBy,
    })
    .returning();
  if (!row) throw new Error("旅行の作成に失敗しました");
  await replaceTripCurrencies(db, row.id, input.currencies);
  await replaceTripAreas(db, row.id, input.areas);
  return row;
}

export async function updateTrip(
  db: Db,
  id: number,
  input: TripInput,
): Promise<void> {
  await db
    .update(trips)
    .set({
      name: input.name,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      note: input.note ?? null,
      updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    })
    .where(eq(trips.id, id));
  await replaceTripCurrencies(db, id, input.currencies);
  await replaceTripAreas(db, id, input.areas);
}

/** 通貨は行の増減も並べ替えもあるので、まとめて入れ替える */
async function replaceTripCurrencies(
  db: Db,
  tripId: number,
  currencies: readonly TripCurrencyInput[],
): Promise<void> {
  await db.delete(tripCurrencies).where(eq(tripCurrencies.tripId, tripId));
  if (currencies.length === 0) return;
  await db.insert(tripCurrencies).values(
    currencies.map((c, i) => ({
      tripId,
      code: c.code,
      rateToJpy: c.rateToJpy,
      sortOrder: i,
    })),
  );
}

/**
 * エリアは名前で指定する。行の増減も並べ替えもあるが、
 * 残る名前の id は変えない（記録が指しているため）。
 */
async function replaceTripAreas(
  db: Db,
  tripId: number,
  names: readonly string[],
): Promise<void> {
  const existing = await db
    .select()
    .from(tripAreas)
    .where(eq(tripAreas.tripId, tripId));
  const byName = new Map(existing.map((a) => [a.name, a]));

  for (const area of existing) {
    // 消されたエリアを指していた記録は、外部キーの set null で残る
    if (!names.includes(area.name))
      await db.delete(tripAreas).where(eq(tripAreas.id, area.id));
  }
  for (const [index, name] of names.entries()) {
    const found = byName.get(name);
    if (found) {
      if (found.sortOrder !== index) {
        await db
          .update(tripAreas)
          .set({ sortOrder: index })
          .where(eq(tripAreas.id, found.id));
      }
    } else {
      await db.insert(tripAreas).values({ tripId, name, sortOrder: index });
    }
  }
}

/** 旅行を削除する。記録・写真・コメント・通貨・エリアは外部キーの cascade で消える */
export async function deleteTrip(db: Db, id: number): Promise<void> {
  await db.delete(trips).where(eq(trips.id, id));
}

/** 旅行に紐づく写真の R2 キー（削除時に実体を消すため） */
export async function listTripPhotoKeys(
  db: Db,
  tripId: number,
): Promise<string[]> {
  const rows = await db
    .select({ key: entryPhotos.key })
    .from(entryPhotos)
    .innerJoin(entries, eq(entries.id, entryPhotos.entryId))
    .where(eq(entries.tripId, tripId));
  return rows.map((r) => r.key);
}

/* ── entries ───────────────────────────────────────────────── */

export type EntryAuthor = Pick<User, "id" | "name" | "email" | "image">;
export type EntryWithMeta = Entry & {
  author: EntryAuthor;
  photos: EntryPhoto[];
  commentCount: number;
};

const authorColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  image: users.image,
};

export type EntryFilter = {
  kind?: string;
  minRating?: number;
  areaId?: number;
};

export async function listEntries(
  db: Db,
  tripId: number,
  filter: EntryFilter = {},
): Promise<EntryWithMeta[]> {
  const conditions = [eq(entries.tripId, tripId)];
  if (filter.kind) conditions.push(eq(entries.kind, filter.kind));
  if (filter.minRating)
    conditions.push(sql`${entries.rating} >= ${filter.minRating}`);
  if (filter.areaId) conditions.push(eq(entries.areaId, filter.areaId));

  const rows = await db
    .select({
      entry: entries,
      author: authorColumns,
      commentCount: sql<number>`(select count(*) from ${comments} where ${comments.entryId} = ${entries.id})`,
    })
    .from(entries)
    .innerJoin(users, eq(users.id, entries.authorId))
    .where(and(...conditions))
    .orderBy(desc(entries.happenedAt), desc(entries.id));

  const photos = await listPhotosFor(
    db,
    rows.map((r) => r.entry.id),
  );
  return rows.map((r) => ({
    ...r.entry,
    author: r.author,
    commentCount: Number(r.commentCount),
    photos: photos.get(r.entry.id) ?? [],
  }));
}

async function listPhotosFor(
  db: Db,
  entryIds: readonly number[],
): Promise<Map<number, EntryPhoto[]>> {
  const grouped = new Map<number, EntryPhoto[]>();
  if (entryIds.length === 0) return grouped;
  const rows = await db
    .select()
    .from(entryPhotos)
    .where(inArray(entryPhotos.entryId, [...entryIds]))
    .orderBy(asc(entryPhotos.sortOrder), asc(entryPhotos.id));
  for (const row of rows) {
    const list = grouped.get(row.entryId);
    if (list) list.push(row);
    else grouped.set(row.entryId, [row]);
  }
  return grouped;
}

export async function getEntry(
  db: Db,
  id: number,
): Promise<EntryWithMeta | null> {
  const [row] = await db
    .select({
      entry: entries,
      author: authorColumns,
      commentCount: sql<number>`(select count(*) from ${comments} where ${comments.entryId} = ${entries.id})`,
    })
    .from(entries)
    .innerJoin(users, eq(users.id, entries.authorId))
    .where(eq(entries.id, id))
    .limit(1);
  if (!row) return null;
  const photos = await listPhotosFor(db, [id]);
  return {
    ...row.entry,
    author: row.author,
    commentCount: Number(row.commentCount),
    photos: photos.get(id) ?? [],
  };
}

export type EntryInput = {
  kind: string;
  title: string;
  place?: string;
  mapUrl?: string;
  /** どのエリアか。未指定なら null */
  areaId?: number;
  amountMinor?: number;
  amountCurrency?: string;
  rating?: number;
  note?: string;
  happenedAt: string;
};

export async function createEntry(
  db: Db,
  tripId: number,
  input: EntryInput,
  authorId: number,
): Promise<Entry> {
  const [row] = await db
    .insert(entries)
    .values({
      tripId,
      kind: input.kind,
      title: input.title,
      place: input.place ?? null,
      mapUrl: input.mapUrl ?? null,
      areaId: input.areaId ?? null,
      amountMinor: input.amountMinor ?? null,
      amountCurrency: input.amountCurrency ?? null,
      rating: input.rating ?? null,
      note: input.note ?? null,
      happenedAt: input.happenedAt,
      authorId,
    })
    .returning();
  if (!row) throw new Error("記録の作成に失敗しました");
  return row;
}

export async function updateEntry(
  db: Db,
  id: number,
  input: EntryInput,
): Promise<void> {
  await db
    .update(entries)
    .set({
      kind: input.kind,
      title: input.title,
      place: input.place ?? null,
      mapUrl: input.mapUrl ?? null,
      areaId: input.areaId ?? null,
      amountMinor: input.amountMinor ?? null,
      amountCurrency: input.amountCurrency ?? null,
      rating: input.rating ?? null,
      note: input.note ?? null,
      happenedAt: input.happenedAt,
      updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    })
    .where(eq(entries.id, id));
}

export async function deleteEntry(db: Db, id: number): Promise<void> {
  await db.delete(entries).where(eq(entries.id, id));
}

/* ── photos ────────────────────────────────────────────────── */

export async function addPhotos(
  db: Db,
  entryId: number,
  photos: readonly { key: string; contentType: string }[],
): Promise<void> {
  if (photos.length === 0) return;
  const [{ maxOrder } = { maxOrder: null }] = await db
    .select({ maxOrder: sql<number | null>`max(${entryPhotos.sortOrder})` })
    .from(entryPhotos)
    .where(eq(entryPhotos.entryId, entryId));
  const base = maxOrder === null ? 0 : Number(maxOrder) + 1;
  await db.insert(entryPhotos).values(
    photos.map((p, i) => ({
      entryId,
      key: p.key,
      contentType: p.contentType,
      sortOrder: base + i,
    })),
  );
}

export async function getPhoto(db: Db, id: number): Promise<EntryPhoto | null> {
  const [row] = await db
    .select()
    .from(entryPhotos)
    .where(eq(entryPhotos.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * 指定した写真を先頭に移し、一覧のサムネイルにする。
 * 並び順は 0 から振り直す（削除を繰り返しても値が離れていかない）。
 */
export async function setCoverPhoto(db: Db, id: number): Promise<void> {
  const photo = await getPhoto(db, id);
  if (!photo) return;

  const rows = await db
    .select({ id: entryPhotos.id })
    .from(entryPhotos)
    .where(eq(entryPhotos.entryId, photo.entryId))
    .orderBy(asc(entryPhotos.sortOrder), asc(entryPhotos.id));

  const ordered = [
    id,
    ...rows.map((r) => r.id).filter((rowId) => rowId !== id),
  ];
  for (const [index, photoId] of ordered.entries()) {
    await db
      .update(entryPhotos)
      .set({ sortOrder: index })
      .where(eq(entryPhotos.id, photoId));
  }
}

export async function deletePhoto(db: Db, id: number): Promise<void> {
  await db.delete(entryPhotos).where(eq(entryPhotos.id, id));
}

export async function listEntryPhotoKeys(
  db: Db,
  entryId: number,
): Promise<string[]> {
  const rows = await db
    .select({ key: entryPhotos.key })
    .from(entryPhotos)
    .where(eq(entryPhotos.entryId, entryId));
  return rows.map((r) => r.key);
}

/* ── comments ──────────────────────────────────────────────── */

export type CommentWithAuthor = Comment & { author: EntryAuthor };

export async function listComments(
  db: Db,
  entryId: number,
): Promise<CommentWithAuthor[]> {
  const rows = await db
    .select({ comment: comments, author: authorColumns })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.entryId, entryId))
    .orderBy(asc(comments.createdAt), asc(comments.id));
  return rows.map((r) => ({ ...r.comment, author: r.author }));
}

export async function getComment(db: Db, id: number): Promise<Comment | null> {
  const [row] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, id))
    .limit(1);
  return row ?? null;
}

export async function createComment(
  db: Db,
  input: { entryId: number; parentId?: number; body: string },
  authorId: number,
): Promise<Comment> {
  const [row] = await db
    .insert(comments)
    .values({
      entryId: input.entryId,
      parentId: input.parentId ?? null,
      body: input.body,
      authorId,
    })
    .returning();
  if (!row) throw new Error("コメントの作成に失敗しました");
  return row;
}

/** コメントを削除する。返信もまとめて消す */
export async function deleteComment(db: Db, id: number): Promise<void> {
  await db.delete(comments).where(eq(comments.parentId, id));
  await db.delete(comments).where(eq(comments.id, id));
}
