import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv, type TestEnv } from "@/test/d1";
import { getProduct, getRecord, getVariant, listCategories, listMakers, listProducts, listRecords, listStores, listVariants } from "./queries";
import { categories, priceRecords, products, variants } from "./schema";

let t: TestEnv;

beforeAll(async () => {
	t = await createTestEnv();
});
afterAll(() => t.dispose());
beforeEach(() => t.truncate());

async function seed() {
	await t.db.insert(categories).values([{ name: "飲料" }, { name: "乳製品" }]);
	await t.db.insert(products).values([
		{ name: "無調整豆乳", categoryId: 1, unit: "ml" },
		{ name: "卵", categoryId: 2, unit: "個" },
		{ name: "未分類の何か", unit: "g" },
	]);
	// 荷姿の id は商品の id と揃えておく
	await t.db.insert(variants).values([
		{ productId: 1, amount: 1000 },
		{ productId: 2, amount: 10 },
		{ productId: 3, amount: 100 },
	]);
	await t.db.insert(priceRecords).values([
		{ variantId: 1, store: "OKストア", price: 198, quantity: 1, recordedAt: "2026-09-10" },
		{ variantId: 1, store: "業務スーパー", price: 548, quantity: 3, recordedAt: "2026-09-11" },
		{ variantId: 1, store: "コンビニ", price: 248, quantity: 1, recordedAt: "2026-09-12" },
		{ variantId: 2, store: "ライフ", price: 258, quantity: 1, recordedAt: "2026-09-12" },
	]);
}

describe("listCategories", () => {
	it("名前順で返す", async () => {
		await seed();
		expect((await listCategories(t.db)).map((c) => c.name)).toEqual(["乳製品", "飲料"]);
	});
});

/** 商品と荷姿をまとめて作る。荷姿の id は渡した順に 1 から振られる */
async function seedProduct(product: { name: string; unit: "g" | "ml" | "個" }, packs: { amount: number; count?: number }[]) {
	const [p] = await t.db.insert(products).values(product).returning({ id: products.id });
	await t.db.insert(variants).values(packs.map((v) => ({ productId: p.id, ...v })));
	return p.id;
}

describe("listProducts", () => {
	it("荷姿ごとに単価最小の記録を best として返す", async () => {
		await seed();
		const items = await listProducts(t.db);
		const soy = items.find((i) => i.name === "無調整豆乳")!;
		expect(soy.categoryName).toBe("飲料");
		// 548 / 3000 = 0.1827 < 198 / 1000 = 0.198
		expect(soy.variants).toMatchObject([{ amount: 1000, best: { store: "業務スーパー", price: 548, quantity: 3 } }]);
	});

	it("記録の無い荷姿は best が null", async () => {
		await seed();
		const items = await listProducts(t.db);
		const none = items.find((i) => i.name === "未分類の何か")!;
		expect(none.variants).toMatchObject([{ best: null }]);
		expect(none.categoryName).toBeNull();
	});

	it("荷姿の無い商品は variants が空", async () => {
		await t.db.insert(products).values({ name: "荷姿なし", unit: "g" });
		expect(await listProducts(t.db)).toMatchObject([{ name: "荷姿なし", variants: [] }]);
	});

	it("荷姿違いは 1 つの商品にまとまり、最安値は荷姿ごとに判定する", async () => {
		await seedProduct({ name: "リステリン", unit: "ml" }, [{ amount: 3000 }, { amount: 1000 }]);
		await t.db.insert(priceRecords).values([
			// 3000ml のほうが単価は安いが、1000ml の最安値には混ざらない
			{ variantId: 1, store: "コストコ", price: 2728, quantity: 1, recordedAt: "2026-09-12" },
			{ variantId: 2, store: "アオキ", price: 1078, quantity: 1, recordedAt: "2026-09-12" },
			{ variantId: 2, store: "スギ薬局", price: 1097, quantity: 1, recordedAt: "2026-09-12" },
		]);
		const items = await listProducts(t.db);
		expect(items).toHaveLength(1);
		// 合計容量の小さい順に並ぶ
		expect(items[0].variants).toMatchObject([
			{ amount: 1000, best: { store: "アオキ" } },
			{ amount: 3000, best: { store: "コストコ" } },
		]);
	});

	it("荷姿の並びは入数を掛けた合計容量で決まる", async () => {
		await seedProduct({ name: "金麦", unit: "ml" }, [{ amount: 350, count: 24 }, { amount: 500, count: 1 }, { amount: 350, count: 6 }]);
		const [item] = await listProducts(t.db);
		expect(item.variants.map((v) => [v.amount, v.count])).toEqual([
			[500, 1],
			[350, 6],
			[350, 24],
		]);
	});

	it("単価が同率なら新しい記録を優先する", async () => {
		await seedProduct({ name: "同率", unit: "g" }, [{ amount: 100 }]);
		await t.db.insert(priceRecords).values([
			{ variantId: 1, store: "古い店", price: 100, quantity: 1, recordedAt: "2026-01-01" },
			{ variantId: 1, store: "新しい店", price: 200, quantity: 2, recordedAt: "2026-06-01" },
		]);
		const [item] = await listProducts(t.db);
		expect(item.variants[0].best?.store).toBe("新しい店");
	});

	it("カテゴリで絞り込める", async () => {
		await seed();
		const items = await listProducts(t.db, { categoryId: 2 });
		expect(items.map((i) => i.name)).toEqual(["卵"]);
		expect(items[0].variants).toHaveLength(1);
	});

	it("商品名の部分一致で検索できる", async () => {
		await seed();
		expect((await listProducts(t.db, { query: "豆乳" })).map((i) => i.name)).toEqual(["無調整豆乳"]);
		expect(await listProducts(t.db, { query: "存在しない" })).toEqual([]);
	});

	it("カテゴリと検索を同時に指定できる", async () => {
		await seed();
		expect(await listProducts(t.db, { categoryId: 1, query: "卵" })).toEqual([]);
		expect((await listProducts(t.db, { categoryId: 1, query: "豆" })).length).toBe(1);
	});

	it("入数を掛けた合計容量で最安値が決まる", async () => {
		await seedProduct({ name: "缶", unit: "ml" }, [{ amount: 350, count: 6 }]);
		await t.db.insert(priceRecords).values([
			{ variantId: 1, store: "高い店", price: 900, quantity: 1, recordedAt: "2026-09-10" },
			{ variantId: 1, store: "安い店", price: 833, quantity: 1, recordedAt: "2026-09-11" },
		]);
		const [item] = await listProducts(t.db);
		expect(item.variants[0].best?.store).toBe("安い店");
	});

	it("空の DB では空配列", async () => {
		expect(await listProducts(t.db)).toEqual([]);
	});
});

describe("listVariants / getVariant", () => {
	it("商品の荷姿を合計容量の小さい順に返す", async () => {
		await seedProduct({ name: "a", unit: "ml" }, [{ amount: 2000 }, { amount: 500 }]);
		await seedProduct({ name: "b", unit: "ml" }, [{ amount: 100 }]);
		expect((await listVariants(t.db, 1)).map((v) => v.amount)).toEqual([500, 2000]);
	});

	it("ID で 1 件取得、無ければ null", async () => {
		await seedProduct({ name: "a", unit: "ml" }, [{ amount: 2000 }]);
		expect(await getVariant(t.db, 1)).toMatchObject({ productId: 1, amount: 2000, count: 1 });
		expect(await getVariant(t.db, 999)).toBeNull();
	});
});

describe("getProduct", () => {
	it("カテゴリ名付きで返し、無ければ null", async () => {
		await seed();
		expect(await getProduct(t.db, 1)).toMatchObject({ name: "無調整豆乳", categoryName: "飲料", unit: "ml" });
		expect(await getProduct(t.db, 3)).toMatchObject({ categoryName: null });
		expect(await getProduct(t.db, 999)).toBeNull();
	});
});

describe("listRecords", () => {
	it("単価の安い順に返す", async () => {
		await seed();
		const rows = await listRecords(t.db, 1);
		expect(rows.map((r) => r.store)).toEqual(["業務スーパー", "OKストア", "コンビニ"]);
	});
	it("他の荷姿の記録は含まない", async () => {
		await seed();
		expect((await listRecords(t.db, 2)).map((r) => r.store)).toEqual(["ライフ"]);
	});
});

describe("getRecord", () => {
	it("ID で 1 件取得、無ければ null", async () => {
		await seed();
		expect(await getRecord(t.db, 1)).toMatchObject({ store: "OKストア" });
		expect(await getRecord(t.db, 999)).toBeNull();
	});
});

describe("listStores", () => {
	it("重複なし・名前順", async () => {
		await seed();
		await t.db.insert(priceRecords).values({ variantId: 2, store: "OKストア", price: 300, quantity: 1, recordedAt: "2026-09-12" });
		// SQLite の既定照合は UTF-8 のバイト順（ASCII → カタカナ → 漢字）
		expect(await listStores(t.db)).toEqual(["OKストア", "コンビニ", "ライフ", "業務スーパー"]);
		expect(new Set(await listStores(t.db)).size).toBe(4);
	});
});

describe("listMakers", () => {
	it("重複なしで返し、未設定は含めない", async () => {
		await t.db.insert(products).values([
			{ name: "a", unit: "g", maker: "Kikkoman" },
			{ name: "b", unit: "g", maker: "Kikkoman" },
			{ name: "c", unit: "g", maker: "Ajinomoto" },
			{ name: "d", unit: "g" },
		]);
		expect(await listMakers(t.db)).toEqual(["Ajinomoto", "Kikkoman"]);
	});

	it("1 件も無ければ空", async () => {
		expect(await listMakers(t.db)).toEqual([]);
	});
});

describe("外部キー制約", () => {
	it("商品削除で荷姿と価格記録も消える（CASCADE）", async () => {
		await seed();
		await t.db.delete(products).where(eq(products.id, 1));
		expect(await listVariants(t.db, 1)).toEqual([]);
		expect(await listRecords(t.db, 1)).toEqual([]);
	});
	it("荷姿削除で価格記録も消える（CASCADE）", async () => {
		await seed();
		await t.db.delete(variants).where(eq(variants.id, 1));
		expect(await listRecords(t.db, 1)).toEqual([]);
		expect(await getProduct(t.db, 1)).not.toBeNull();
	});
	it("カテゴリ削除で商品は未分類になる（SET NULL）", async () => {
		await seed();
		await t.db.delete(categories).where(eq(categories.id, 1));
		expect((await getProduct(t.db, 1))?.categoryId).toBeNull();
	});
});
