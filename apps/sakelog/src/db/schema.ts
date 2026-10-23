import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

/** ログインした Google アカウント。記録者の表示名・アイコンの出どころ */
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

/**
 * 飲んだ（または買った）お酒 1 本。
 *
 * 種類（ワイン / ビール / 日本酒 / 焼酎 / ウイスキー / ジン）をまたいで 1 つの表に持つ。
 * 共通する項目のほうが多く、一覧も横断で見たいため。種類でしか意味を持たない項目は
 * null 許容の列として並べ、どの種類でどれを出すかは src/lib/categories.ts が決める。
 */
export const drinks = sqliteTable(
  "drinks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** 銘柄。ラベルに書かれている名前をそのまま入れる */
    name: text("name").notNull(),
    /** 造り手。呼び方は種類で変わる（生産者 / 蔵元 / ブルワリー / 蒸留所） */
    maker: text("maker"),
    /** 種類。取りうる値は src/lib/categories.ts */
    category: text("category").notNull().default("wine"),
    /** 種類の中での分類（赤 / IPA / 純米吟醸 / シングルモルト など）。自由入力も許す */
    style: text("style"),
    /** ヴィンテージや蒸留年。意味を持たない種類では使わない */
    year: integer("year"),
    /** アルコール度数（%）。未入力なら null */
    abv: real("abv"),
    country: text("country"),
    region: text("region"),

    /* ── 種類ごとの項目（SPECIFIC_FIELDS と 1 対 1） ── */
    /** 日本酒: 精米歩合（%） */
    polishingRate: integer("polishing_rate"),
    /** 日本酒: 日本酒度（+ が辛口） */
    sakeMeterValue: real("sake_meter_value"),
    /** 日本酒: 酸度 */
    acidity: real("acidity"),
    /** ウイスキー: 熟成年数 */
    agedYears: integer("aged_years"),
    /** ウイスキー: 樽の種類 */
    caskType: text("cask_type"),
    /** ビール: 苦さの指標 */
    ibu: integer("ibu"),
    /** 焼酎: 蒸留方法（常圧 / 減圧） */
    distillation: text("distillation"),

    /** priceCurrency の最小単位での価格。未入力なら null */
    priceMinor: integer("price_minor"),
    /** 価格をどの通貨で入力したか。未入力なら null */
    priceCurrency: text("price_currency"),
    /** 買った店・飲んだ店など */
    shop: text("shop"),
    /** 店の URL（任意）。https のみ。src/lib/shop-url.ts で検証してから入れる */
    shopUrl: text("shop_url"),
    /** 飲んだ日（YYYY-MM-DD）。まだ開けていなければ null */
    drunkAt: text("drunk_at"),

    /** 評価は 1〜5。未評価なら null。軸の定義は src/lib/ratings.ts */
    ratingOverall: integer("rating_overall"),
    ratingAroma: integer("rating_aroma"),
    ratingTaste: integer("rating_taste"),
    ratingFinish: integer("rating_finish"),
    ratingValue: integer("rating_value"),

    /** 感想 */
    note: text("note"),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [
    // 一覧は「飲んだ日の新しい順」が既定
    index("drinks_drunk_at_idx").on(t.drunkAt),
    // 一覧の「種類」「★4 以上」での絞り込み用
    index("drinks_category_rating_idx").on(t.category, t.ratingOverall),
  ],
);

/**
 * 材料のタグ。
 *
 * ブドウ品種・ホップ・酒米・焼酎の原料・ジンのボタニカルを同じ形で持つ。
 * どれも「1 本に複数ある」「名前で絞り込みたい」という扱いが同じなので分けない。
 * 呼び方だけ種類ごとに変える（src/lib/categories.ts の ingredientLabel）。
 */
export const drinkIngredients = sqliteTable(
  "drink_ingredients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    drinkId: integer("drink_id")
      .notNull()
      .references(() => drinks.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** フォームで並べた順。表示順もこれに従う */
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("drink_ingredients_drink_name_idx").on(t.drinkId, t.name),
    // 材料名での絞り込み用
    index("drink_ingredients_name_idx").on(t.name),
  ],
);

/** お酒に添付した写真（実体は R2、ここにはキーだけ） */
export const drinkPhotos = sqliteTable(
  "drink_photos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    drinkId: integer("drink_id")
      .notNull()
      .references(() => drinks.id, { onDelete: "cascade" }),
    /** R2 のオブジェクトキー */
    key: text("key").notNull(),
    contentType: text("content_type").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("drink_photos_drink_idx").on(t.drinkId, t.sortOrder)],
);

export type User = typeof users.$inferSelect;
export type Drink = typeof drinks.$inferSelect;
export type DrinkIngredient = typeof drinkIngredients.$inferSelect;
export type DrinkPhoto = typeof drinkPhotos.$inferSelect;
