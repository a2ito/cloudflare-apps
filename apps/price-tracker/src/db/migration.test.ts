import { afterEach, describe, expect, it } from "vitest";
import { createTestEnvUpTo, type TestEnv } from "@/test/d1";

/**
 * 容量を価格記録から商品へ移す移行（0004, 0005）の検証。
 * 移行前のスキーマでデータを作り、移行を適用して結果を確かめる。
 */
let t: TestEnv;

afterEach(() => t?.dispose());

type Row = Record<string, unknown>;

async function query(sql: string): Promise<Row[]> {
	const result = await t.d1.prepare(sql).all();
	return result.results as Row[];
}

/** 移行前の状態を作る。price_records が容量を持っていた頃の形 */
async function seedBeforeMigration(
	products: { id: number; name: string; unit: string }[],
	records: { productId: number; store: string; price: number; amount: number; quantity?: number }[],
) {
	t = await createTestEnvUpTo("0003");
	for (const p of products) {
		await t.d1.prepare("INSERT INTO products (id, name, unit) VALUES (?, ?, ?)").bind(p.id, p.name, p.unit).run();
	}
	for (const r of records) {
		await t.d1
			.prepare("INSERT INTO price_records (product_id, store, price, amount, quantity, recorded_at) VALUES (?, ?, ?, ?, ?, '2026-09-12')")
			.bind(r.productId, r.store, r.price, r.amount, r.quantity ?? 1)
			.run();
	}
}

async function runMigration() {
	await t.applyMigration("0004");
	await t.applyMigration("0005");
}

describe("容量を商品へ移す移行", () => {
	it("荷姿が 1 種類の商品は、その容量がそのまま入り名前は変わらない", async () => {
		await seedBeforeMigration(
			[{ id: 1, name: "こくいも", unit: "ml" }],
			[
				{ productId: 1, store: "やまや", price: 1188, amount: 1800 },
				{ productId: 1, store: "イオン", price: 1250, amount: 1800 },
			],
		);
		await runMigration();

		const products = await query("SELECT name, amount FROM products");
		expect(products).toEqual([{ name: "こくいも", amount: 1800 }]);
		expect(await query("SELECT COUNT(*) AS n FROM price_records WHERE product_id = 1")).toEqual([{ n: 2 }]);
	});

	it("荷姿が複数ある商品は、荷姿ごとに分かれて名前に容量が付く", async () => {
		await seedBeforeMigration(
			[{ id: 1, name: "リステリン", unit: "ml" }],
			[
				{ productId: 1, store: "アオキ", price: 1078, amount: 1000 },
				{ productId: 1, store: "スギ薬局", price: 1097, amount: 1000 },
				{ productId: 1, store: "スギ薬局", price: 1840, amount: 2000 },
				{ productId: 1, store: "スギ薬局", price: 2728, amount: 3000 },
			],
		);
		await runMigration();

		const products = await query("SELECT name, amount FROM products ORDER BY amount");
		expect(products).toEqual([
			{ name: "リステリン 1000ml", amount: 1000 },
			{ name: "リステリン 2000ml", amount: 2000 },
			{ name: "リステリン 3000ml", amount: 3000 },
		]);
	});

	it("分割後、各記録は容量の合う商品に紐づく", async () => {
		await seedBeforeMigration(
			[{ id: 1, name: "クロレッツ", unit: "g" }],
			[
				{ productId: 1, store: "アオキ", price: 645, amount: 140 },
				{ productId: 1, store: "コストコ", price: 1580, amount: 420 },
			],
		);
		await runMigration();

		const rows = await query(
			"SELECT p.name, p.amount, r.store, r.price FROM price_records r JOIN products p ON p.id = r.product_id ORDER BY p.amount",
		);
		expect(rows).toEqual([
			{ name: "クロレッツ 140g", amount: 140, store: "アオキ", price: 645 },
			{ name: "クロレッツ 420g", amount: 420, store: "コストコ", price: 1580 },
		]);
	});

	it("記録の多い荷姿が元の商品に残る", async () => {
		await seedBeforeMigration(
			[{ id: 1, name: "金麦", unit: "ml" }],
			[
				{ productId: 1, store: "イオン", price: 833, amount: 2100 },
				{ productId: 1, store: "スギ薬局", price: 844, amount: 2100 },
				{ productId: 1, store: "アオキ", price: 856, amount: 2100 },
				{ productId: 1, store: "Amazon", price: 4055, amount: 8400 },
			],
		);
		await runMigration();

		// 記録が 3 件ある 2100ml が id=1 に残り、8400ml が新しい商品になる
		const rows = await query("SELECT id, name, amount FROM products ORDER BY id");
		expect(rows[0]).toMatchObject({ id: 1, amount: 2100 });
		expect(rows[1]).toMatchObject({ amount: 8400 });
		expect(await query("SELECT COUNT(*) AS n FROM price_records WHERE product_id = 1")).toEqual([{ n: 3 }]);
	});

	it("小数の容量も扱える", async () => {
		await seedBeforeMigration(
			[{ id: 1, name: "だし", unit: "g" }],
			[
				{ productId: 1, store: "A", price: 300, amount: 7.5 },
				{ productId: 1, store: "B", price: 500, amount: 15 },
			],
		);
		await runMigration();

		const names = (await query("SELECT name FROM products ORDER BY amount")).map((r) => r.name);
		expect(names).toEqual(["だし 7.5g", "だし 15g"]);
	});

	it("記録が 1 件も無い商品は既定値のまま残る", async () => {
		await seedBeforeMigration([{ id: 1, name: "未記録の商品", unit: "g" }], []);
		await runMigration();
		expect(await query("SELECT name, amount FROM products")).toEqual([{ name: "未記録の商品", amount: 1 }]);
	});

	it("複数の商品が混ざっていても互いに影響しない", async () => {
		await seedBeforeMigration(
			[
				{ id: 1, name: "商品A", unit: "ml" },
				{ id: 2, name: "商品B", unit: "g" },
			],
			[
				{ productId: 1, store: "X", price: 100, amount: 500 },
				{ productId: 1, store: "Y", price: 180, amount: 1000 },
				{ productId: 2, store: "X", price: 200, amount: 100 },
			],
		);
		await runMigration();

		const rows = await query(
			"SELECT p.name, p.amount, COUNT(r.id) AS records FROM products p LEFT JOIN price_records r ON r.product_id = p.id GROUP BY p.id ORDER BY p.id",
		);
		expect(rows).toEqual([
			{ name: "商品A 500ml", amount: 500, records: 1 },
			{ name: "商品B", amount: 100, records: 1 },
			{ name: "商品A 1000ml", amount: 1000, records: 1 },
		]);
	});
});

/**
 * 荷姿を商品から切り出し、荷姿違いを 1 つの商品にまとめる移行（0008）の検証。
 */
async function seedBefore0008(
	products: { id: number; name: string; unit: string; amount: number; count?: number; maker?: string; imageKey?: string }[],
	records: { productId: number; store: string; price: number; quantity?: number }[],
) {
	t = await createTestEnvUpTo("0007");
	for (const p of products) {
		await t.d1
			.prepare("INSERT INTO products (id, name, unit, amount, count, maker, image_key) VALUES (?, ?, ?, ?, ?, ?, ?)")
			.bind(p.id, p.name, p.unit, p.amount, p.count ?? 1, p.maker ?? null, p.imageKey ?? null)
			.run();
	}
	for (const r of records) {
		await t.d1
			.prepare("INSERT INTO price_records (product_id, store, price, quantity, recorded_at) VALUES (?, ?, ?, ?, '2026-09-12')")
			.bind(r.productId, r.store, r.price, r.quantity ?? 1)
			.run();
	}
}

/** 商品ごとの荷姿と、荷姿ごとの記録の店舗を並べる */
async function variantSummary(): Promise<Row[]> {
	return query(`
		SELECT p.id AS productId, p.name, v.amount, v.count, group_concat(r.store, ',') AS stores
		FROM products p
		JOIN variants v ON v.product_id = p.id
		LEFT JOIN price_records r ON r.variant_id = v.id
		GROUP BY v.id
		ORDER BY p.id, v.amount * v.count
	`);
}

describe("荷姿を切り出してまとめる移行", () => {
	it("荷姿が 1 つの商品は、名前を変えずに荷姿 1 件を持つ", async () => {
		await seedBefore0008(
			[{ id: 1, name: "金麦", unit: "ml", amount: 350, count: 6 }],
			[{ productId: 1, store: "イオン", price: 833 }],
		);
		await t.applyMigration("0008");

		expect(await variantSummary()).toEqual([{ productId: 1, name: "金麦", amount: 350, count: 6, stores: "イオン" }]);
	});

	it("容量付きの名前で分かれた商品を 1 つにまとめ、名前から容量を外す", async () => {
		await seedBefore0008(
			[
				{ id: 1, name: "リステリン 1000ml", unit: "ml", amount: 1000, maker: "J&J", imageKey: "products/a.jpg" },
				{ id: 2, name: "リステリン 2000ml", unit: "ml", amount: 2000, imageKey: "products/a.jpg" },
				{ id: 3, name: "リステリン 3000ml", unit: "ml", amount: 3000 },
			],
			[
				{ productId: 1, store: "アオキ", price: 1078 },
				{ productId: 2, store: "スギ薬局", price: 1840 },
				{ productId: 3, store: "コストコ", price: 2728 },
			],
		);
		await t.applyMigration("0008");

		expect(await variantSummary()).toEqual([
			{ productId: 1, name: "リステリン", amount: 1000, count: 1, stores: "アオキ" },
			{ productId: 1, name: "リステリン", amount: 2000, count: 1, stores: "スギ薬局" },
			{ productId: 1, name: "リステリン", amount: 3000, count: 1, stores: "コストコ" },
		]);
		// まとめ先（id が最小の商品）の属性が残る
		expect(await query("SELECT maker, image_key FROM products")).toEqual([{ maker: "J&J", image_key: "products/a.jpg" }]);
	});

	it("小数の容量で分かれた商品もまとめる", async () => {
		await seedBefore0008(
			[
				{ id: 1, name: "だし 7.5g", unit: "g", amount: 7.5 },
				{ id: 2, name: "だし 15g", unit: "g", amount: 15 },
			],
			[],
		);
		await t.applyMigration("0008");
		expect((await variantSummary()).map((r) => [r.name, r.amount])).toEqual([
			["だし", 7.5],
			["だし", 15],
		]);
	});

	it("容量付きの名前が 1 件しか無ければ、利用者の付けた名前として残す", async () => {
		await seedBefore0008([{ id: 1, name: "牛乳 1000ml", unit: "ml", amount: 1000 }], []);
		await t.applyMigration("0008");
		expect(await query("SELECT name FROM products")).toEqual([{ name: "牛乳 1000ml" }]);
	});

	it("単位が違うものはまとめない", async () => {
		await seedBefore0008(
			[
				{ id: 1, name: "米 5個", unit: "個", amount: 5 },
				{ id: 2, name: "米 5g", unit: "g", amount: 5 },
			],
			[],
		);
		await t.applyMigration("0008");
		expect(await query("SELECT name FROM products ORDER BY id")).toEqual([{ name: "米 5個" }, { name: "米 5g" }]);
	});

	it("名前の末尾が自分の容量と合わないものはまとめない", async () => {
		// 荷姿を後から編集して容量と名前がずれた商品
		await seedBefore0008(
			[
				{ id: 1, name: "豆乳 1000ml", unit: "ml", amount: 1000 },
				{ id: 2, name: "豆乳 200ml", unit: "ml", amount: 250 },
			],
			[],
		);
		await t.applyMigration("0008");
		expect(await query("SELECT name FROM products ORDER BY id")).toEqual([{ name: "豆乳 1000ml" }, { name: "豆乳 200ml" }]);
	});

	it("容量を外した名前が既存の別商品と同じでも、そちらは巻き込まない", async () => {
		await seedBefore0008(
			[
				{ id: 1, name: "豆乳", unit: "ml", amount: 1000 },
				{ id: 2, name: "豆乳 200ml", unit: "ml", amount: 200 },
				{ id: 3, name: "豆乳 500ml", unit: "ml", amount: 500 },
			],
			[],
		);
		await t.applyMigration("0008");
		expect((await variantSummary()).map((r) => [r.productId, r.name, r.amount])).toEqual([
			[1, "豆乳", 1000],
			[2, "豆乳", 200],
			[2, "豆乳", 500],
		]);
	});

	it("価格記録の id と内容はそのまま残る", async () => {
		await seedBefore0008(
			[{ id: 1, name: "卵", unit: "個", amount: 10 }],
			[
				{ productId: 1, store: "ライフ", price: 258, quantity: 2 },
				{ productId: 1, store: "OK", price: 238 },
			],
		);
		await t.applyMigration("0008");
		expect(await query("SELECT id, variant_id, store, price, quantity FROM price_records ORDER BY id")).toEqual([
			{ id: 1, variant_id: 1, store: "ライフ", price: 258, quantity: 2 },
			{ id: 2, variant_id: 1, store: "OK", price: 238, quantity: 1 },
		]);
	});

	it("移行後に追加した荷姿は既存の id と重ならない", async () => {
		await seedBefore0008([{ id: 5, name: "卵", unit: "個", amount: 10 }], []);
		await t.applyMigration("0008");
		await t.d1.prepare("INSERT INTO variants (product_id, amount) VALUES (5, 6)").run();
		expect(await query("SELECT id FROM variants ORDER BY id")).toEqual([{ id: 5 }, { id: 6 }]);
	});

	it("0005 で分けた商品が、0008 で元の 1 商品に戻る", async () => {
		await seedBeforeMigration(
			[{ id: 1, name: "リステリン", unit: "ml" }],
			[
				{ productId: 1, store: "アオキ", price: 1078, amount: 1000 },
				{ productId: 1, store: "スギ薬局", price: 1840, amount: 2000 },
			],
		);
		for (const m of ["0004", "0005", "0006", "0007", "0008"]) await t.applyMigration(m);

		expect(await variantSummary()).toEqual([
			{ productId: 1, name: "リステリン", amount: 1000, count: 1, stores: "アオキ" },
			{ productId: 1, name: "リステリン", amount: 2000, count: 1, stores: "スギ薬局" },
		]);
	});
});
