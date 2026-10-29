import { asc, count, desc, eq, isNotNull } from "drizzle-orm";
import { pickBest, type CompareItem, type SpecCell } from "@/lib/compare";
import { jstDateOf } from "@/lib/date";
import type { Db } from "./index";
import {
  categories,
  priceRecords,
  products,
  specFields,
  specValues,
  type Category,
  type PriceRecord,
  type Product,
  type SpecField,
} from "./schema";

export type CategoryListItem = Category & {
  productCount: number;
  fieldCount: number;
};

export async function listCategories(db: Db): Promise<CategoryListItem[]> {
  const [rows, productCounts, fieldCounts] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.name)),
    db
      .select({ categoryId: products.categoryId, n: count() })
      .from(products)
      .groupBy(products.categoryId),
    db
      .select({ categoryId: specFields.categoryId, n: count() })
      .from(specFields)
      .groupBy(specFields.categoryId),
  ]);
  const p = new Map(productCounts.map((r) => [r.categoryId, r.n]));
  const f = new Map(fieldCounts.map((r) => [r.categoryId, r.n]));
  return rows.map((c) => ({
    ...c,
    productCount: p.get(c.id) ?? 0,
    fieldCount: f.get(c.id) ?? 0,
  }));
}

export async function getCategory(
  db: Db,
  id: number,
): Promise<Category | null> {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** 比較表の列の順に返す */
export async function listFields(
  db: Db,
  categoryId: number,
): Promise<SpecField[]> {
  return db
    .select()
    .from(specFields)
    .where(eq(specFields.categoryId, categoryId))
    .orderBy(asc(specFields.position), asc(specFields.id));
}

export async function getField(db: Db, id: number): Promise<SpecField | null> {
  const rows = await db
    .select()
    .from(specFields)
    .where(eq(specFields.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * カテゴリの商品をスペック値と最安値つきで返す。
 * 商品 ID を IN で渡すと D1 のバインド変数の上限（100）に当たるため、どれもカテゴリで絞って引く。
 * includeUsed を渡さなければ、最安値は新品の記録だけから選ぶ
 */
export async function listCompareItems(
  db: Db,
  categoryId: number,
  includeUsed = false,
): Promise<CompareItem[]> {
  const [rows, values, records] = await Promise.all([
    db
      .select()
      .from(products)
      .where(eq(products.categoryId, categoryId))
      .orderBy(asc(products.id)),
    db
      .select({
        productId: specValues.productId,
        fieldId: specValues.fieldId,
        num: specValues.valueNum,
        text: specValues.valueText,
      })
      .from(specValues)
      .innerJoin(products, eq(products.id, specValues.productId))
      .where(eq(products.categoryId, categoryId)),
    db
      .select({
        id: priceRecords.id,
        productId: priceRecords.productId,
        store: priceRecords.store,
        price: priceRecords.price,
        used: priceRecords.used,
        recordedAt: priceRecords.recordedAt,
        url: priceRecords.url,
      })
      .from(priceRecords)
      .innerJoin(products, eq(products.id, priceRecords.productId))
      .where(eq(products.categoryId, categoryId)),
  ]);

  const specsByProduct = new Map<number, Record<number, SpecCell>>();
  for (const v of values) {
    const specs = specsByProduct.get(v.productId) ?? {};
    specs[v.fieldId] = { num: v.num, text: v.text };
    specsByProduct.set(v.productId, specs);
  }
  const recordsByProduct = Map.groupBy(records, (r) => r.productId);

  return rows.map((p) => {
    const best = pickBest(recordsByProduct.get(p.id) ?? [], includeUsed);
    return {
      id: p.id,
      name: p.name,
      maker: p.maker,
      imageKey: p.imageKey,
      hidden: p.hidden,
      favorite: p.favorite,
      createdAt: jstDateOf(p.createdAt),
      specs: specsByProduct.get(p.id) ?? {},
      best: best && {
        id: best.id,
        store: best.store,
        price: best.price,
        used: best.used,
        recordedAt: best.recordedAt,
        url: best.url,
      },
    };
  });
}

export async function getProduct(
  db: Db,
  id: number,
): Promise<(Product & { categoryName: string }) | null> {
  const rows = await db
    .select({ product: products, categoryName: categories.name })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.id, id))
    .limit(1);
  const row = rows[0];
  return row ? { ...row.product, categoryName: row.categoryName } : null;
}

/** 商品のスペック値。fieldId → 値 */
export async function getProductSpecs(
  db: Db,
  productId: number,
): Promise<Record<number, SpecCell>> {
  const rows = await db
    .select()
    .from(specValues)
    .where(eq(specValues.productId, productId));
  return Object.fromEntries(
    rows.map((r) => [r.fieldId, { num: r.valueNum, text: r.valueText }]),
  );
}

/** 安い順。同額なら新しい記録を先に */
export async function listRecords(
  db: Db,
  productId: number,
): Promise<PriceRecord[]> {
  return db
    .select()
    .from(priceRecords)
    .where(eq(priceRecords.productId, productId))
    .orderBy(
      asc(priceRecords.price),
      desc(priceRecords.recordedAt),
      desc(priceRecords.id),
    );
}

export async function getRecord(
  db: Db,
  id: number,
): Promise<PriceRecord | null> {
  const rows = await db
    .select()
    .from(priceRecords)
    .where(eq(priceRecords.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** メーカー名のサジェスト用に既存の値を重複なしで返す */
export async function listMakers(db: Db): Promise<string[]> {
  const rows = await db
    .selectDistinct({ maker: products.maker })
    .from(products)
    .where(isNotNull(products.maker))
    .orderBy(asc(products.maker));
  return rows
    .map((r) => r.maker)
    .filter((m): m is string => m !== null && m !== "");
}

/** 店舗名のサジェスト用に既存の店舗名を重複なしで返す */
export async function listStores(db: Db): Promise<string[]> {
  const rows = await db
    .selectDistinct({ store: priceRecords.store })
    .from(priceRecords)
    .orderBy(asc(priceRecords.store));
  return rows.map((r) => r.store);
}
