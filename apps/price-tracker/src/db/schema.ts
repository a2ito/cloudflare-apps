import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamp = (name: string) =>
	text(name)
		.notNull()
		.default(sql`(datetime('now'))`);

export const categories = sqliteTable("categories", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
	createdAt: timestamp("created_at"),
});

/** 容量の単位。g/ml は 100 あたり、それ以外は 1 あたりの単価を表示する */
export const UNITS = ["g", "ml", "個", "枚", "本", "回"] as const;
export type Unit = (typeof UNITS)[number];

export const products = sqliteTable(
	"products",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		name: text("name").notNull(),
		/** メーカー・ブランド名 */
		maker: text("maker"),
		categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
		/** 荷姿どうしで単価を比べられるよう、単位は商品が持つ */
		unit: text("unit", { enum: UNITS }).notNull().default("g"),
		imageKey: text("image_key"),
		memo: text("memo"),
		/**
		 * 単価とは別の比較軸（任意）。プロテインのタンパク質量など。
		 * 栄養表示をそのまま写せるよう「metricBasis（商品の単位）あたり metricAmount（metricUnit）」で持つ。
		 * 4 つとも入っているか、4 つとも空かのどちらか
		 */
		metricName: text("metric_name"),
		metricUnit: text("metric_unit"),
		metricBasis: real("metric_basis"),
		metricAmount: real("metric_amount"),
		createdAt: timestamp("created_at"),
		updatedAt: timestamp("updated_at"),
	},
	(t) => [index("products_category_idx").on(t.categoryId)],
);

/**
 * 荷姿。同じ商品でも容量や入数が違えば別の荷姿として、最安値を別々に判定する。
 * まとめ買いの割安さで大容量が常に勝ってしまい、同じ荷姿どうしの比較ができなくなるのを避けるため
 */
export const variants = sqliteTable(
	"variants",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		productId: integer("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),
		/** 1 個あたりの容量 */
		amount: real("amount").notNull(),
		/** 1 パッケージに入っている個数。350ml × 6 本なら 6 */
		count: integer("count").notNull().default(1),
		createdAt: timestamp("created_at"),
	},
	(t) => [index("variants_product_idx").on(t.productId)],
);

export const priceRecords = sqliteTable(
	"price_records",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		variantId: integer("variant_id")
			.notNull()
			.references(() => variants.id, { onDelete: "cascade" }),
		store: text("store").notNull(),
		/** 税込価格（円） */
		price: integer("price").notNull(),
		/** 購入個数（同じ荷姿をまとめ買いした場合） */
		quantity: integer("quantity").notNull().default(1),
		/** 記録日 YYYY-MM-DD */
		recordedAt: text("recorded_at").notNull(),
		/** 商品ページやチラシへのリンク（http/https のみ） */
		url: text("url"),
		/** 値札やレシートの写真。R2 のオブジェクトキー */
		imageKey: text("image_key"),
		memo: text("memo"),
		createdAt: timestamp("created_at"),
	},
	(t) => [index("price_records_variant_idx").on(t.variantId)],
);

export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type PriceRecord = typeof priceRecords.$inferSelect;
