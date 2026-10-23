import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { SpecificField } from "@/lib/categories";
import type { Db } from "./index";
import { drinkIngredients, drinkPhotos, drinks, users } from "./schema";
import type { Drink, DrinkIngredient, DrinkPhoto, User } from "./schema";

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

/* ── drinks ────────────────────────────────────────────────── */

export type DrinkAuthor = Pick<User, "id" | "name" | "email" | "image">;

export type DrinkWithMeta = Drink & {
  author: DrinkAuthor;
  ingredients: DrinkIngredient[];
  photos: DrinkPhoto[];
};

const authorColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  image: users.image,
};

export type DrinkFilter = {
  /** 銘柄・造り手・産地・店名・材料への部分一致 */
  q?: string;
  category?: string;
  style?: string;
  /** 材料名の完全一致 */
  ingredient?: string;
  minRating?: number;
};

export type DrinkSort = "recent" | "rating" | "price";

/**
 * 一覧。既定は飲んだ日の新しい順で、未開栓（drunk_at が null）は末尾に置く。
 * 「まだ飲んでいない」は日付の前後で並べようがないため。
 */
export async function listDrinks(
  db: Db,
  filter: DrinkFilter = {},
  sort: DrinkSort = "recent",
): Promise<DrinkWithMeta[]> {
  const conditions: SQL[] = [];

  const q = filter.q?.trim();
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    conditions.push(
      sql`(lower(${drinks.name}) like ${like} or lower(coalesce(${drinks.maker}, '')) like ${like}
				or lower(coalesce(${drinks.region}, '')) like ${like} or lower(coalesce(${drinks.country}, '')) like ${like}
				or lower(coalesce(${drinks.style}, '')) like ${like} or lower(coalesce(${drinks.shop}, '')) like ${like}
				or exists (select 1 from ${drinkIngredients} i where i.drink_id = ${drinks.id} and lower(i.name) like ${like}))`,
    );
  }
  if (filter.category) conditions.push(eq(drinks.category, filter.category));
  if (filter.style) conditions.push(eq(drinks.style, filter.style));
  if (filter.ingredient) {
    conditions.push(
      sql`exists (select 1 from ${drinkIngredients} i where i.drink_id = ${drinks.id} and lower(i.name) = ${filter.ingredient.trim().toLowerCase()})`,
    );
  }
  if (filter.minRating)
    conditions.push(sql`${drinks.ratingOverall} >= ${filter.minRating}`);

  const orderBy =
    sort === "rating"
      ? [
          sql`${drinks.ratingOverall} is null`,
          desc(drinks.ratingOverall),
          desc(drinks.id),
        ]
      : sort === "price"
        ? [
            sql`${drinks.priceMinor} is null`,
            desc(drinks.priceMinor),
            desc(drinks.id),
          ]
        : [
            sql`${drinks.drunkAt} is null`,
            desc(drinks.drunkAt),
            desc(drinks.id),
          ];

  const rows = await db
    .select({ drink: drinks, author: authorColumns })
    .from(drinks)
    .innerJoin(users, eq(users.id, drinks.authorId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(...orderBy);

  const ids = rows.map((r) => r.drink.id);
  const [ingredients, photos] = await Promise.all([
    listIngredientsFor(db, ids),
    listPhotosFor(db, ids),
  ]);
  return rows.map((r) => ({
    ...r.drink,
    author: r.author,
    ingredients: ingredients.get(r.drink.id) ?? [],
    photos: photos.get(r.drink.id) ?? [],
  }));
}

async function listIngredientsFor(
  db: Db,
  drinkIds: readonly number[],
): Promise<Map<number, DrinkIngredient[]>> {
  const grouped = new Map<number, DrinkIngredient[]>();
  if (drinkIds.length === 0) return grouped;
  const rows = await db
    .select()
    .from(drinkIngredients)
    .where(inArray(drinkIngredients.drinkId, [...drinkIds]))
    .orderBy(asc(drinkIngredients.sortOrder), asc(drinkIngredients.id));
  for (const row of rows) {
    const list = grouped.get(row.drinkId);
    if (list) list.push(row);
    else grouped.set(row.drinkId, [row]);
  }
  return grouped;
}

async function listPhotosFor(
  db: Db,
  drinkIds: readonly number[],
): Promise<Map<number, DrinkPhoto[]>> {
  const grouped = new Map<number, DrinkPhoto[]>();
  if (drinkIds.length === 0) return grouped;
  const rows = await db
    .select()
    .from(drinkPhotos)
    .where(inArray(drinkPhotos.drinkId, [...drinkIds]))
    .orderBy(asc(drinkPhotos.sortOrder), asc(drinkPhotos.id));
  for (const row of rows) {
    const list = grouped.get(row.drinkId);
    if (list) list.push(row);
    else grouped.set(row.drinkId, [row]);
  }
  return grouped;
}

export async function getDrink(
  db: Db,
  id: number,
): Promise<DrinkWithMeta | null> {
  const [row] = await db
    .select({ drink: drinks, author: authorColumns })
    .from(drinks)
    .innerJoin(users, eq(users.id, drinks.authorId))
    .where(eq(drinks.id, id))
    .limit(1);
  if (!row) return null;
  const [ingredients, photos] = await Promise.all([
    listIngredientsFor(db, [id]),
    listPhotosFor(db, [id]),
  ]);
  return {
    ...row.drink,
    author: row.author,
    ingredients: ingredients.get(id) ?? [],
    photos: photos.get(id) ?? [],
  };
}

/** 絞り込みの選択肢に出す、実際に記録されている材料（多い順） */
export async function listIngredientNames(
  db: Db,
  category?: string,
): Promise<string[]> {
  const rows = await db
    .select({ name: drinkIngredients.name, count: sql<number>`count(*)` })
    .from(drinkIngredients)
    .innerJoin(drinks, eq(drinks.id, drinkIngredients.drinkId))
    .where(category ? eq(drinks.category, category) : undefined)
    .groupBy(drinkIngredients.name)
    .orderBy(desc(sql`count(*)`), asc(drinkIngredients.name));
  return rows.map((r) => r.name);
}

/** 記録されている種類と件数（一覧の絞り込みに出す） */
export async function countByCategory(db: Db): Promise<Map<string, number>> {
  const rows = await db
    .select({ category: drinks.category, count: sql<number>`count(*)` })
    .from(drinks)
    .groupBy(drinks.category);
  return new Map(rows.map((r) => [r.category, Number(r.count)]));
}

/** 種類ごとの項目。値を入れてよいかは src/lib/categories.ts が決める */
export type SpecificValues = Partial<
  Record<SpecificField, number | string | undefined>
>;

export type DrinkInput = {
  name: string;
  maker?: string;
  category: string;
  style?: string;
  year?: number;
  abv?: number;
  country?: string;
  region?: string;
  priceMinor?: number;
  priceCurrency?: string;
  shop?: string;
  shopUrl?: string;
  drunkAt?: string;
  ratingOverall?: number;
  ratingAroma?: number;
  ratingTaste?: number;
  ratingFinish?: number;
  ratingValue?: number;
  note?: string;
  /** 材料。並べた順がそのまま表示順になる */
  ingredients: string[];
  /** 種類ごとの項目。その種類で意味を持たないものは呼び出し側で落としてある */
  specifics: SpecificValues;
};

/** undefined を null に寄せる（DB は「未入力」を null で持つ） */
function toColumns(input: DrinkInput) {
  const s = input.specifics;
  return {
    name: input.name,
    maker: input.maker ?? null,
    category: input.category,
    style: input.style ?? null,
    year: input.year ?? null,
    abv: input.abv ?? null,
    country: input.country ?? null,
    region: input.region ?? null,
    polishingRate: (s.polishingRate as number | undefined) ?? null,
    sakeMeterValue: (s.sakeMeterValue as number | undefined) ?? null,
    acidity: (s.acidity as number | undefined) ?? null,
    agedYears: (s.agedYears as number | undefined) ?? null,
    caskType: (s.caskType as string | undefined) ?? null,
    ibu: (s.ibu as number | undefined) ?? null,
    distillation: (s.distillation as string | undefined) ?? null,
    priceMinor: input.priceMinor ?? null,
    priceCurrency: input.priceCurrency ?? null,
    shop: input.shop ?? null,
    shopUrl: input.shopUrl ?? null,
    drunkAt: input.drunkAt ?? null,
    ratingOverall: input.ratingOverall ?? null,
    ratingAroma: input.ratingAroma ?? null,
    ratingTaste: input.ratingTaste ?? null,
    ratingFinish: input.ratingFinish ?? null,
    ratingValue: input.ratingValue ?? null,
    note: input.note ?? null,
  };
}

export async function createDrink(
  db: Db,
  input: DrinkInput,
  authorId: number,
): Promise<Drink> {
  const [row] = await db
    .insert(drinks)
    .values({ ...toColumns(input), authorId })
    .returning();
  if (!row) throw new Error("記録の保存に失敗しました");
  await replaceIngredients(db, row.id, input.ingredients);
  return row;
}

export async function updateDrink(
  db: Db,
  id: number,
  input: DrinkInput,
): Promise<void> {
  await db
    .update(drinks)
    .set({
      ...toColumns(input),
      updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    })
    .where(eq(drinks.id, id));
  await replaceIngredients(db, id, input.ingredients);
}

/** 材料は行の増減も並べ替えもあるので、まとめて入れ替える */
async function replaceIngredients(
  db: Db,
  drinkId: number,
  names: readonly string[],
): Promise<void> {
  await db
    .delete(drinkIngredients)
    .where(eq(drinkIngredients.drinkId, drinkId));
  if (names.length === 0) return;
  await db
    .insert(drinkIngredients)
    .values(names.map((name, i) => ({ drinkId, name, sortOrder: i })));
}

/** 記録を削除する。材料と写真の行は外部キーの cascade で消える */
export async function deleteDrink(db: Db, id: number): Promise<void> {
  await db.delete(drinks).where(eq(drinks.id, id));
}

/* ── photos ────────────────────────────────────────────────── */

export async function addPhotos(
  db: Db,
  drinkId: number,
  photos: readonly { key: string; contentType: string }[],
): Promise<void> {
  if (photos.length === 0) return;
  const [{ maxOrder } = { maxOrder: null }] = await db
    .select({ maxOrder: sql<number | null>`max(${drinkPhotos.sortOrder})` })
    .from(drinkPhotos)
    .where(eq(drinkPhotos.drinkId, drinkId));
  const base = maxOrder === null ? 0 : Number(maxOrder) + 1;
  await db.insert(drinkPhotos).values(
    photos.map((p, i) => ({
      drinkId,
      key: p.key,
      contentType: p.contentType,
      sortOrder: base + i,
    })),
  );
}

export async function getPhoto(db: Db, id: number): Promise<DrinkPhoto | null> {
  const [row] = await db
    .select()
    .from(drinkPhotos)
    .where(eq(drinkPhotos.id, id))
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
    .select({ id: drinkPhotos.id })
    .from(drinkPhotos)
    .where(eq(drinkPhotos.drinkId, photo.drinkId))
    .orderBy(asc(drinkPhotos.sortOrder), asc(drinkPhotos.id));

  const ordered = [
    id,
    ...rows.map((r) => r.id).filter((rowId) => rowId !== id),
  ];
  for (const [index, photoId] of ordered.entries()) {
    await db
      .update(drinkPhotos)
      .set({ sortOrder: index })
      .where(eq(drinkPhotos.id, photoId));
  }
}

export async function deletePhoto(db: Db, id: number): Promise<void> {
  await db.delete(drinkPhotos).where(eq(drinkPhotos.id, id));
}

export async function listDrinkPhotoKeys(
  db: Db,
  drinkId: number,
): Promise<string[]> {
  const rows = await db
    .select({ key: drinkPhotos.key })
    .from(drinkPhotos)
    .where(eq(drinkPhotos.drinkId, drinkId));
  return rows.map((r) => r.key);
}
