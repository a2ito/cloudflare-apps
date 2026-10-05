import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { expectRedirect, revalidated } from "@/test/action-mocks";
import { createTestEnv, fakeImage, formData, type TestEnv } from "@/test/d1";
import { getProduct, listRecords, listVariants } from "@/db/queries";
import { categories, priceRecords, products, variants } from "@/db/schema";

let t: TestEnv;
vi.mock("@/lib/auth", async () => ({ requireUser: async () => (await import("@/test/action-mocks")).fakeUser }));
vi.mock("@/lib/cloudflare", () => ({ getEnv: () => Promise.resolve(t.env) }));
vi.mock("next/cache", async () => {
	const { revalidated } = await import("@/test/action-mocks");
	return { revalidatePath: (p: string) => void revalidated.push(p) };
});
vi.mock("next/navigation", async () => {
	const { RedirectSignal } = await import("@/test/action-mocks");
	return { redirect: (to: string) => { throw new RedirectSignal(to); } };
});
const { createProduct, deleteProduct, mergeProduct, updateProduct } = await import("./products");

beforeAll(async () => {
	t = await createTestEnv();
});
afterAll(() => t.dispose());
beforeEach(async () => {
	await t.truncate();
	revalidated.length = 0;
});

async function r2Keys(): Promise<string[]> {
	return (await t.bucket.list()).objects.map((o) => o.key);
}

describe("createProduct", () => {
	it("登録して詳細ページへリダイレクトする", async () => {
		await t.db.insert(categories).values({ name: "飲料" });
		const to = await expectRedirect(() =>
			createProduct({}, formData({ name: "無調整豆乳", categoryId: 1, unit: "ml", amount: 1000, memo: "  成分無調整  " })),
		);
		expect(to).toBe("/products/1");
		expect(await getProduct(t.db, 1)).toMatchObject({ name: "無調整豆乳", categoryId: 1, unit: "ml", memo: "成分無調整", imageKey: null });
		expect(revalidated).toContain("/");
	});

	it("最初の荷姿もあわせて作る", async () => {
		await expectRedirect(() => createProduct({}, formData({ name: "金麦", unit: "ml", amount: 350, count: 6 })));
		expect(await listVariants(t.db, 1)).toMatchObject([{ productId: 1, amount: 350, count: 6 }]);
	});

	it("入数を省略すると 1", async () => {
		await expectRedirect(() => createProduct({}, formData({ name: "豆乳", unit: "ml", amount: 1000 })));
		expect(await listVariants(t.db, 1)).toMatchObject([{ amount: 1000, count: 1 }]);
	});

	it("容量が無ければ検証エラーで商品を作らない", async () => {
		const state = await createProduct({}, formData({ name: "豆乳", unit: "ml" }));
		expect(state.error).toMatch(/^amount:/);
		expect(await t.db.select().from(products)).toEqual([]);
	});

	it("メーカー名を保存する", async () => {
		await expectRedirect(() => createProduct({}, formData({ name: "豆乳", unit: "ml", amount: 100, maker: "  マルサン  " })));
		expect(await getProduct(t.db, 1)).toMatchObject({ maker: "マルサン" });
	});

	it("メーカー名が空なら null", async () => {
		await expectRedirect(() => createProduct({}, formData({ name: "豆乳", unit: "ml", amount: 100, maker: "" })));
		expect((await getProduct(t.db, 1))?.maker).toBeNull();
	});

	it("カテゴリ未選択・メモ空は null で保存", async () => {
		await expectRedirect(() => createProduct({}, formData({ name: "卵", categoryId: "", unit: "個", amount: 100, memo: "" })));
		expect(await getProduct(t.db, 1)).toMatchObject({ categoryId: null, memo: null });
	});

	it("画像があれば R2 に保存してキーを持つ", async () => {
		await expectRedirect(() => createProduct({}, formData({ name: "卵", unit: "個", amount: 100, image: fakeImage("image/webp", 50, "a.webp") })));
		const p = await getProduct(t.db, 1);
		expect(p?.imageKey).toMatch(/^products\/.+\.webp$/);
		expect(await r2Keys()).toEqual([p!.imageKey]);
	});

	it("空のファイル入力（未選択）は画像なし扱い", async () => {
		await expectRedirect(() => createProduct({}, formData({ name: "卵", unit: "個", amount: 100, image: new File([], "", { type: "application/octet-stream" }) })));
		expect((await getProduct(t.db, 1))?.imageKey).toBeNull();
	});

	it("不正な単位は検証エラーで DB に触らない", async () => {
		const state = await createProduct({}, formData({ name: "卵", unit: "kg", amount: 100 }));
		expect(state.error).toMatch(/^unit:/);
		expect(await t.db.select().from(products)).toEqual([]);
	});

	it("商品名が空なら検証エラー", async () => {
		const state = await createProduct({}, formData({ name: "", unit: "g" }));
		expect(state.error).toMatch(/商品名を入力/);
	});

	it("画像形式が不正ならエラーを返し、商品は作らない", async () => {
		const state = await createProduct({}, formData({ name: "卵", unit: "個", amount: 100, image: fakeImage("text/plain", 10, "x.txt") }));
		expect(state.error).toMatch(/対応していない画像形式/);
		expect(await t.db.select().from(products)).toEqual([]);
		expect(await r2Keys()).toEqual([]);
	});
});

describe("updateProduct", () => {
	it("項目を更新して詳細へ戻る", async () => {
		await t.db.insert(categories).values([{ name: "A" }, { name: "B" }]);
		await t.db.insert(products).values({ name: "旧", categoryId: 1, unit: "g" });
		const to = await expectRedirect(() => updateProduct({}, formData({ id: 1, name: "新", categoryId: 2, unit: "ml", memo: "m" })));
		expect(to).toBe("/products/1");
		expect(await getProduct(t.db, 1)).toMatchObject({ name: "新", categoryId: 2, unit: "ml", memo: "m" });
		expect(revalidated).toEqual(expect.arrayContaining(["/", "/products/1"]));
	});

	it("新しい画像を付けると旧画像は R2 から消える", async () => {
		await t.bucket.put("products/old.jpg", new Uint8Array(3));
		await t.db.insert(products).values({ name: "p", unit: "g", imageKey: "products/old.jpg" });
		await expectRedirect(() => updateProduct({}, formData({ id: 1, name: "p", unit: "g", image: fakeImage() })));
		const p = await getProduct(t.db, 1);
		expect(p?.imageKey).not.toBe("products/old.jpg");
		expect(await r2Keys()).toEqual([p!.imageKey]);
	});

	it("removeImage を付けると画像を消して null にする", async () => {
		await t.bucket.put("products/old.jpg", new Uint8Array(3));
		await t.db.insert(products).values({ name: "p", unit: "g", imageKey: "products/old.jpg" });
		await expectRedirect(() => updateProduct({}, formData({ id: 1, name: "p", unit: "g", removeImage: "on" })));
		expect((await getProduct(t.db, 1))?.imageKey).toBeNull();
		expect(await r2Keys()).toEqual([]);
	});

	it("荷姿を変えずに残す", async () => {
		await t.db.insert(products).values({ name: "p", unit: "ml" });
		await t.db.insert(variants).values({ productId: 1, amount: 350, count: 6 });
		await expectRedirect(() => updateProduct({}, formData({ id: 1, name: "p2", unit: "ml", amount: 1, count: 1 })));
		expect(await listVariants(t.db, 1)).toMatchObject([{ amount: 350, count: 6 }]);
	});

	it("別の商品が同じ画像を使っていれば R2 から消さない", async () => {
		// 荷姿ごとの分割（マイグレーション 0005）で image_key が複製されるため
		await t.bucket.put("products/shared.jpg", new Uint8Array(3));
		await t.db.insert(products).values([
			{ name: "p1", unit: "g", imageKey: "products/shared.jpg" },
			{ name: "p2", unit: "g", imageKey: "products/shared.jpg" },
		]);
		await expectRedirect(() => updateProduct({}, formData({ id: 1, name: "p1", unit: "g", image: fakeImage() })));
		const p1 = await getProduct(t.db, 1);
		expect(p1?.imageKey).not.toBe("products/shared.jpg");
		expect((await getProduct(t.db, 2))?.imageKey).toBe("products/shared.jpg");
		expect((await r2Keys()).sort()).toEqual(["products/shared.jpg", p1!.imageKey].sort());
	});

	it("価格記録が同じ画像を使っていれば R2 から消さない", async () => {
		await t.bucket.put("products/shared.jpg", new Uint8Array(3));
		await t.db.insert(products).values({ name: "p", unit: "g", imageKey: "products/shared.jpg" });
		await t.db.insert(variants).values({ productId: 1, amount: 100 });
		await t.db.insert(priceRecords).values({ variantId: 1, store: "s", price: 100, quantity: 1, recordedAt: "2026-09-12", imageKey: "products/shared.jpg" });
		await expectRedirect(() => updateProduct({}, formData({ id: 1, name: "p", unit: "g", removeImage: "on" })));
		expect((await getProduct(t.db, 1))?.imageKey).toBeNull();
		expect(await r2Keys()).toEqual(["products/shared.jpg"]);
	});

	it("画像を変更しなければ既存キーを保持する", async () => {
		await t.db.insert(products).values({ name: "p", unit: "g", imageKey: "products/keep.jpg" });
		await expectRedirect(() => updateProduct({}, formData({ id: 1, name: "p2", unit: "g" })));
		expect((await getProduct(t.db, 1))?.imageKey).toBe("products/keep.jpg");
	});

	it("メーカー名を変更できる", async () => {
		await t.db.insert(products).values({ name: "p", unit: "g", maker: "旧メーカー" });
		await expectRedirect(() => updateProduct({}, formData({ id: 1, name: "p", unit: "g", maker: "新メーカー" })));
		expect((await getProduct(t.db, 1))?.maker).toBe("新メーカー");
	});

	it("メーカー名を空に戻せる", async () => {
		await t.db.insert(products).values({ name: "p", unit: "g", maker: "メーカー" });
		await expectRedirect(() => updateProduct({}, formData({ id: 1, name: "p", unit: "g", maker: "" })));
		expect((await getProduct(t.db, 1))?.maker).toBeNull();
	});

	it("存在しない商品はエラー", async () => {
		const state = await updateProduct({}, formData({ id: 999, name: "p", unit: "g" }));
		expect(state).toEqual({ error: "商品が見つかりません" });
	});
});

describe("deleteProduct", () => {
	it("商品・価格記録・画像をまとめて削除し一覧へ戻る", async () => {
		await t.bucket.put("products/x.jpg", new Uint8Array(3));
		await t.db.insert(products).values({ name: "p", unit: "g", imageKey: "products/x.jpg" });
		await t.db.insert(variants).values({ productId: 1, amount: 100 });
		await t.db.insert(priceRecords).values({ variantId: 1, store: "s", price: 100, quantity: 1, recordedAt: "2026-09-12" });

		const to = await expectRedirect(() => deleteProduct(formData({ id: 1 })));
		expect(to).toBe("/");
		expect(await getProduct(t.db, 1)).toBeNull();
		expect(await listVariants(t.db, 1)).toEqual([]);
		expect(await listRecords(t.db, 1)).toEqual([]);
		expect(await r2Keys()).toEqual([]);
	});

	it("画像を共有する商品が残っていれば R2 から消さない", async () => {
		await t.bucket.put("products/shared.jpg", new Uint8Array(3));
		await t.db.insert(products).values([
			{ name: "p1", unit: "g", imageKey: "products/shared.jpg" },
			{ name: "p2", unit: "g", imageKey: "products/shared.jpg" },
		]);
		await expectRedirect(() => deleteProduct(formData({ id: 1 })));
		expect(await getProduct(t.db, 1)).toBeNull();
		expect(await r2Keys()).toEqual(["products/shared.jpg"]);
	});

	it("すべての荷姿の価格記録の写真も R2 から消える", async () => {
		await t.bucket.put("products/product.jpg", new Uint8Array(3));
		await t.bucket.put("products/record-a.jpg", new Uint8Array(3));
		await t.bucket.put("products/record-b.jpg", new Uint8Array(3));
		await t.db.insert(products).values({ name: "p", unit: "g", imageKey: "products/product.jpg" });
		await t.db.insert(variants).values([
			{ productId: 1, amount: 100 },
			{ productId: 1, amount: 500 },
		]);
		await t.db.insert(priceRecords).values([
			{ variantId: 1, store: "a", price: 100, quantity: 1, recordedAt: "2026-09-12", imageKey: "products/record-a.jpg" },
			{ variantId: 2, store: "b", price: 200, quantity: 1, recordedAt: "2026-09-12", imageKey: "products/record-b.jpg" },
			{ variantId: 1, store: "c", price: 300, quantity: 1, recordedAt: "2026-09-12" },
		]);

		await expectRedirect(() => deleteProduct(formData({ id: 1 })));
		expect(await r2Keys()).toEqual([]);
	});

	it("存在しない商品でもエラーにならず一覧へ戻る", async () => {
		expect(await expectRedirect(() => deleteProduct(formData({ id: 42 })))).toBe("/");
	});
});

describe("比較軸", () => {
	const protein = { metricName: "タンパク質", metricUnit: "g", metricBasis: 30, metricAmount: 21 };

	it("登録時に 4 項目を保存する", async () => {
		await expectRedirect(() => createProduct({}, formData({ name: "ホエイ", unit: "g", amount: 1000, ...protein })));
		expect(await getProduct(t.db, 1)).toMatchObject(protein);
	});

	it("すべて空なら null で保存する", async () => {
		await expectRedirect(() =>
			createProduct({}, formData({ name: "ホエイ", unit: "g", amount: 1000, metricName: "", metricUnit: "", metricBasis: "", metricAmount: "" })),
		);
		expect(await getProduct(t.db, 1)).toMatchObject({ metricName: null, metricUnit: null, metricBasis: null, metricAmount: null });
	});

	it("一部だけ入れると検証エラーで商品を作らない", async () => {
		const state = await createProduct({}, formData({ name: "ホエイ", unit: "g", amount: 1000, metricName: "タンパク質", metricAmount: 21 }));
		expect(state.error).toMatch(/すべて入れるか、すべて空/);
		expect(await t.db.select().from(products)).toEqual([]);
	});

	it("基準量が 0 なら検証エラー", async () => {
		const state = await createProduct({}, formData({ name: "ホエイ", unit: "g", amount: 1000, ...protein, metricBasis: 0 }));
		expect(state.error).toMatch(/基準量は 0 より大きい/);
	});

	it("編集で変更でき、すべて空にすれば外せる", async () => {
		await t.db.insert(products).values({ name: "ホエイ", unit: "g", ...protein });
		await expectRedirect(() => updateProduct({}, formData({ id: 1, name: "ホエイ", unit: "g", ...protein, metricAmount: 24 })));
		expect((await getProduct(t.db, 1))?.metricAmount).toBe(24);

		await expectRedirect(() => updateProduct({}, formData({ id: 1, name: "ホエイ", unit: "g" })));
		expect(await getProduct(t.db, 1)).toMatchObject({ metricName: null, metricBasis: null });
	});
});

describe("mergeProduct", () => {
	beforeEach(async () => {
		await t.bucket.put("products/target.jpg", new Uint8Array(3));
		await t.bucket.put("products/source.jpg", new Uint8Array(3));
		await t.db.insert(products).values([
			{ name: "かのか", unit: "ml", maker: "アサヒ", imageKey: "products/target.jpg" },
			{ name: "かのか", unit: "ml", imageKey: "products/source.jpg" },
			{ name: "グラム売り", unit: "g" },
		]);
		await t.db.insert(variants).values([
			{ productId: 1, amount: 1800, count: 1 },
			{ productId: 2, amount: 1800, count: 6 },
			{ productId: 3, amount: 100 },
		]);
		await t.db.insert(priceRecords).values([
			{ variantId: 1, store: "やまや", price: 1188, quantity: 1, recordedAt: "2026-09-12" },
			{ variantId: 2, store: "Amazon", price: 6980, quantity: 1, recordedAt: "2026-09-12" },
		]);
	});

	it("荷姿と価格記録を統合先へ移し、元の商品を消して統合先へ戻る", async () => {
		const to = await expectRedirect(() => mergeProduct(formData({ id: 2, targetId: 1 })));
		expect(to).toBe("/products/1");
		expect(await getProduct(t.db, 2)).toBeNull();
		expect((await listVariants(t.db, 1)).map((v) => [v.id, v.count])).toEqual([
			[1, 1],
			[2, 6],
		]);
		expect(await listRecords(t.db, 2)).toMatchObject([{ store: "Amazon" }]);
		// 名前などは統合先のものが残る
		expect(await getProduct(t.db, 1)).toMatchObject({ name: "かのか", maker: "アサヒ", imageKey: "products/target.jpg" });
		expect(revalidated).toEqual(expect.arrayContaining(["/", "/products/1"]));
	});

	it("元の商品の画像は R2 から消える", async () => {
		await expectRedirect(() => mergeProduct(formData({ id: 2, targetId: 1 })));
		expect(await r2Keys()).toEqual(["products/target.jpg"]);
	});

	it("元の商品の画像を統合先が使っていれば消さない", async () => {
		await t.db.update(products).set({ imageKey: "products/target.jpg" }).where(eq(products.id, 2));
		await expectRedirect(() => mergeProduct(formData({ id: 2, targetId: 1 })));
		expect((await r2Keys()).sort()).toEqual(["products/source.jpg", "products/target.jpg"]);
	});

	it("単位が違う商品へは統合しない", async () => {
		await expect(mergeProduct(formData({ id: 3, targetId: 1 }))).rejects.toThrow(/単位が違う/);
		expect(await listVariants(t.db, 3)).toHaveLength(1);
	});

	it("自分自身へは統合しない", async () => {
		await expect(mergeProduct(formData({ id: 1, targetId: 1 }))).rejects.toThrow(/同じ商品/);
		expect(await getProduct(t.db, 1)).not.toBeNull();
	});

	it.each([
		["統合元", { id: 999, targetId: 1 }],
		["統合先", { id: 2, targetId: 999 }],
	])("%sが無ければ何も変えない", async (_label, fields) => {
		await expect(mergeProduct(formData(fields))).rejects.toThrow(/商品が見つかりません/);
		expect(await listVariants(t.db, 2)).toHaveLength(1);
	});
});
