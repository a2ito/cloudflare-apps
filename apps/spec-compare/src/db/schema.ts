import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamp = (name: string) =>
	text(name)
		.notNull()
		.default(sql`(datetime('now'))`);

export const categories = sqliteTable("categories", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
	createdAt: timestamp("created_at"),
});

/**
 * スペック項目の値の型。
 * number は数値で大小を比べる。bool は「あり / なし」で、あり = 1 として数値と同じ列に持つ。
 * text は型番や CPU 名など、大小を決められないもの
 */
export const FIELD_KINDS = ["number", "text", "bool"] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

/** どちらの値が良いか。none は比べない（色や型番など） */
export const BETTER = ["higher", "lower", "none"] as const;
export type Better = (typeof BETTER)[number];

/**
 * カテゴリごとのスペック項目。同じカテゴリの商品は同じ項目を埋めるので、比較表の列が揃う
 */
export const specFields = sqliteTable(
	"spec_fields",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		categoryId: integer("category_id")
			.notNull()
			.references(() => categories.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		/** 表示用の単位（GB、kg など）。text では使わない */
		unit: text("unit"),
		kind: text("kind", { enum: FIELD_KINDS }).notNull().default("number"),
		better: text("better", { enum: BETTER }).notNull().default("none"),
		/** 比較表の列の並び。小さいほど左 */
		position: integer("position").notNull().default(0),
		createdAt: timestamp("created_at"),
	},
	(t) => [uniqueIndex("spec_fields_category_name_idx").on(t.categoryId, t.name)],
);

/**
 * 比較の候補になる商品。スペック項目はカテゴリが決めるため、カテゴリは必須にしている。
 * カテゴリを変えると埋めたスペックが無意味になるので、登録後にカテゴリは変えさせない
 */
export const products = sqliteTable(
	"products",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		categoryId: integer("category_id")
			.notNull()
			.references(() => categories.id),
		name: text("name").notNull(),
		/** メーカー・ブランド名 */
		maker: text("maker"),
		imageKey: text("image_key"),
		memo: text("memo"),
		createdAt: timestamp("created_at"),
		updatedAt: timestamp("updated_at"),
	},
	(t) => [index("products_category_idx").on(t.categoryId)],
);

/** 商品ごとのスペック値。number / bool は valueNum、text は valueText に入れる。未入力の項目は行を作らない */
export const specValues = sqliteTable(
	"spec_values",
	{
		productId: integer("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),
		fieldId: integer("field_id")
			.notNull()
			.references(() => specFields.id, { onDelete: "cascade" }),
		valueNum: real("value_num"),
		valueText: text("value_text"),
	},
	(t) => [primaryKey({ columns: [t.productId, t.fieldId] }), index("spec_values_field_idx").on(t.fieldId)],
);

/** 店舗ごとの価格。比較には商品ごとの最安値を使う */
export const priceRecords = sqliteTable(
	"price_records",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		productId: integer("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),
		store: text("store").notNull(),
		/** 税込価格（円） */
		price: integer("price").notNull(),
		/** 記録日 YYYY-MM-DD */
		recordedAt: text("recorded_at").notNull(),
		/** 商品ページへのリンク（http/https のみ） */
		url: text("url"),
		memo: text("memo"),
		createdAt: timestamp("created_at"),
	},
	(t) => [index("price_records_product_idx").on(t.productId)],
);

export type Category = typeof categories.$inferSelect;
export type SpecField = typeof specFields.$inferSelect;
export type Product = typeof products.$inferSelect;
export type SpecValue = typeof specValues.$inferSelect;
export type PriceRecord = typeof priceRecords.$inferSelect;
