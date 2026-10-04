import { asc, desc, eq, isNotNull, like, sql, type SQL } from "drizzle-orm";
import type { Db } from "./index";
import { categories, priceRecords, products, variants, type Category, type PriceRecord, type Product, type Variant } from "./schema";

/** 単価（1 unit あたり）の SQL 式。price_records のカラムを参照する */
const unitCostExpr = sql<number>`${priceRecords.price} * 1.0 / ((SELECT v.amount * v.count FROM variants v WHERE v.id = ${priceRecords.variantId}) * ${priceRecords.quantity})`;

export type BestRecord = Pick<PriceRecord, "id" | "store" | "price" | "quantity" | "recordedAt">;
export type VariantWithBest = Variant & { best: BestRecord | null };
export type ProductListItem = Product & { categoryName: string | null; variants: VariantWithBest[] };

export async function listCategories(db: Db): Promise<Category[]> {
	return db.select().from(categories).orderBy(asc(categories.name));
}

/**
 * 荷姿ごとに単価最小（同率なら新しい記録）の 1 件を結合して返す。合計容量の小さい順。
 * 商品 ID を IN で渡すと D1 のバインド変数の上限（100）に当たるため、商品と同じ条件で絞り込む
 */
async function listVariantsWithBest(db: Db, where: SQL | undefined): Promise<VariantWithBest[]> {
	const bestId = sql`(
		SELECT r.id FROM price_records r
		WHERE r.variant_id = ${variants.id}
		ORDER BY r.price * 1.0 / (${variants.amount} * ${variants.count} * r.quantity) ASC, r.recorded_at DESC, r.id DESC
		LIMIT 1
	)`;

	const rows = await db
		.select({
			variant: variants,
			bestId: priceRecords.id,
			bestStore: priceRecords.store,
			bestPrice: priceRecords.price,
			bestQuantity: priceRecords.quantity,
			bestRecordedAt: priceRecords.recordedAt,
		})
		.from(variants)
		.innerJoin(products, eq(products.id, variants.productId))
		.leftJoin(priceRecords, eq(priceRecords.id, bestId))
		.where(where)
		.orderBy(asc(sql`${variants.amount} * ${variants.count}`), asc(variants.id));

	return rows.map((r) => ({
		...r.variant,
		best:
			r.bestId !== null && r.bestStore !== null && r.bestPrice !== null && r.bestQuantity !== null && r.bestRecordedAt !== null
				? { id: r.bestId, store: r.bestStore, price: r.bestPrice, quantity: r.bestQuantity, recordedAt: r.bestRecordedAt }
				: null,
	}));
}

export async function listProducts(
	db: Db,
	filter: { categoryId?: number; query?: string } = {},
): Promise<ProductListItem[]> {
	const conditions = [];
	if (filter.categoryId !== undefined) conditions.push(eq(products.categoryId, filter.categoryId));
	if (filter.query) conditions.push(like(products.name, `%${filter.query}%`));

	const where = conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined;

	const [rows, allVariants] = await Promise.all([
		db
			.select({ product: products, categoryName: categories.name })
			.from(products)
			.leftJoin(categories, eq(categories.id, products.categoryId))
			.where(where)
			.orderBy(asc(categories.name), asc(products.name)),
		listVariantsWithBest(db, where),
	]);
	const byProduct = new Map<number, VariantWithBest[]>();
	for (const v of allVariants) byProduct.set(v.productId, [...(byProduct.get(v.productId) ?? []), v]);
	return rows.map((r) => ({
		...r.product,
		categoryName: r.categoryName,
		variants: byProduct.get(r.product.id) ?? [],
	}));
}

export async function getProduct(db: Db, id: number): Promise<(Product & { categoryName: string | null }) | null> {
	const rows = await db
		.select({ product: products, categoryName: categories.name })
		.from(products)
		.leftJoin(categories, eq(categories.id, products.categoryId))
		.where(eq(products.id, id))
		.limit(1);
	const row = rows[0];
	return row ? { ...row.product, categoryName: row.categoryName } : null;
}

/** 商品の荷姿を合計容量の小さい順に返す */
export async function listVariants(db: Db, productId: number): Promise<Variant[]> {
	return db
		.select()
		.from(variants)
		.where(eq(variants.productId, productId))
		.orderBy(asc(sql`${variants.amount} * ${variants.count}`), asc(variants.id));
}

export async function getVariant(db: Db, id: number): Promise<Variant | null> {
	const rows = await db.select().from(variants).where(eq(variants.id, id)).limit(1);
	return rows[0] ?? null;
}

export async function listRecords(db: Db, variantId: number): Promise<PriceRecord[]> {
	return db
		.select()
		.from(priceRecords)
		.where(eq(priceRecords.variantId, variantId))
		.orderBy(asc(unitCostExpr), desc(priceRecords.recordedAt));
}

export async function getRecord(db: Db, id: number): Promise<PriceRecord | null> {
	const rows = await db.select().from(priceRecords).where(eq(priceRecords.id, id)).limit(1);
	return rows[0] ?? null;
}

/** 画像キーが商品・価格記録のいずれかから参照されているか */
export async function isImageKeyReferenced(db: Db, key: string): Promise<boolean> {
	const product = await db.select({ id: products.id }).from(products).where(eq(products.imageKey, key)).limit(1);
	if (product.length > 0) return true;
	const record = await db.select({ id: priceRecords.id }).from(priceRecords).where(eq(priceRecords.imageKey, key)).limit(1);
	return record.length > 0;
}

/** メーカー名のサジェスト用に既存の値を重複なしで返す */
export async function listMakers(db: Db): Promise<string[]> {
	const rows = await db
		.selectDistinct({ maker: products.maker })
		.from(products)
		.where(isNotNull(products.maker))
		.orderBy(asc(products.maker));
	return rows.map((r) => r.maker).filter((m): m is string => m !== null && m !== "");
}

/** 店舗名のサジェスト用に既存の店舗名を重複なしで返す */
export async function listStores(db: Db): Promise<string[]> {
	const rows = await db.selectDistinct({ store: priceRecords.store }).from(priceRecords).orderBy(asc(priceRecords.store));
	return rows.map((r) => r.store);
}
