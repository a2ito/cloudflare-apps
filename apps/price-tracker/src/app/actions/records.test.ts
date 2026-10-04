import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { expectRedirect, revalidated } from "@/test/action-mocks";
import { createTestEnv, fakeImage, formData, type TestEnv } from "@/test/d1";
import { listRecords } from "@/db/queries";
import { priceRecords, products, variants } from "@/db/schema";

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
const { createRecord, deleteRecord, updateRecord } = await import("./records");

beforeAll(async () => {
	t = await createTestEnv();
});
afterAll(() => t.dispose());
beforeEach(async () => {
	await t.truncate();
	await t.db.insert(products).values([
		{ name: "豆乳", unit: "ml" },
		{ name: "別の商品", unit: "ml" },
	]);
	await t.db.insert(variants).values([
		{ productId: 1, amount: 1000 },
		{ productId: 1, amount: 200 },
		{ productId: 2, amount: 500 },
	]);
	revalidated.length = 0;
});

const valid = { productId: 1, variantId: 1, store: "OKストア", price: 198, quantity: 1, recordedAt: "2026-09-12" };

describe("createRecord", () => {
	it("記録して成功メッセージを返す", async () => {
		const state = await createRecord({}, formData({ ...valid, memo: "セール" }));
		expect(state).toEqual({ success: "価格を記録しました" });
		expect(await listRecords(t.db, 1)).toMatchObject([{ store: "OKストア", price: 198, quantity: 1, memo: "セール" }]);
		expect(revalidated).toEqual(expect.arrayContaining(["/", "/products/1"]));
	});

	it("個数を省略すると 1", async () => {
		await createRecord({}, formData({ ...valid, quantity: undefined }));
		expect((await listRecords(t.db, 1))[0].quantity).toBe(1);
	});

	it.each([
		["店舗が空", { store: "" }, /店舗名を入力/],
		["価格が 0", { price: 0 }, /1 円以上/],
		["価格が小数", { price: "19.8" }, /整数/],
		["日付形式が不正", { recordedAt: "2026/09/12" }, /日付の形式/],
		["個数が 0", { quantity: 0 }, /^quantity:/],
	])("%s なら検証エラー", async (_label, patch, pattern) => {
		const state = await createRecord({}, formData({ ...valid, ...patch }));
		expect(state.error).toMatch(pattern);
		expect(await listRecords(t.db, 1)).toEqual([]);
	});

	it("指定した荷姿にだけ記録する", async () => {
		await createRecord({}, formData({ ...valid, variantId: 2 }));
		expect(await listRecords(t.db, 1)).toEqual([]);
		expect(await listRecords(t.db, 2)).toMatchObject([{ store: "OKストア", variantId: 2 }]);
	});

	it("存在しない荷姿へは記録しない", async () => {
		const state = await createRecord({}, formData({ ...valid, variantId: 999 }));
		expect(state).toEqual({ error: "荷姿が見つかりません" });
	});

	it("別の商品の荷姿へは記録せず、写真も R2 に置かない", async () => {
		const state = await createRecord({}, formData({ ...valid, variantId: 3, image: fakeImage() }));
		expect(state).toEqual({ error: "荷姿が見つかりません" });
		expect(await listRecords(t.db, 3)).toEqual([]);
		expect((await t.bucket.list()).objects).toEqual([]);
	});
});

describe("画像", () => {
	async function r2Keys(): Promise<string[]> {
		return (await t.bucket.list()).objects.map((o) => o.key);
	}

	it("写真を R2 に保存してキーを持つ", async () => {
		await createRecord({}, formData({ ...valid, image: fakeImage("image/png", 40, "tag.png") }));
		const record = (await listRecords(t.db, 1))[0];
		expect(record.imageKey).toMatch(/^products\/.+\.png$/);
		expect(await r2Keys()).toEqual([record.imageKey]);
	});

	it("写真なしなら null で、R2 にも置かない", async () => {
		await createRecord({}, formData(valid));
		expect((await listRecords(t.db, 1))[0].imageKey).toBeNull();
		expect(await r2Keys()).toEqual([]);
	});

	it("対応外の形式は拒否し、記録も作らない", async () => {
		const state = await createRecord({}, formData({ ...valid, image: fakeImage("application/pdf", 10, "x.pdf") }));
		expect(state.error).toMatch(/対応していない画像形式/);
		expect(await listRecords(t.db, 1)).toEqual([]);
		expect(await r2Keys()).toEqual([]);
	});

	it("記録を消すと写真も R2 から消える", async () => {
		await createRecord({}, formData({ ...valid, image: fakeImage() }));
		const record = (await listRecords(t.db, 1))[0];
		expect(await r2Keys()).toEqual([record.imageKey]);

		await deleteRecord(formData({ id: record.id, productId: 1 }));
		expect(await r2Keys()).toEqual([]);
	});
});

describe("updateRecord", () => {
	async function seedRecord(extra: Record<string, unknown> = {}) {
		await t.db.insert(priceRecords).values({
			variantId: 1,
			store: "旧店",
			price: 300,
			quantity: 1,
			recordedAt: "2026-09-01",
			...extra,
		});
		return (await listRecords(t.db, 1))[0];
	}

	async function r2Keys(): Promise<string[]> {
		return (await t.bucket.list()).objects.map((o) => o.key);
	}

	it("内容を更新して詳細へ戻る", async () => {
		const record = await seedRecord();
		const to = await expectRedirect(() =>
			updateRecord({}, formData({ ...valid, id: record.id, store: "新店", price: 199, quantity: 2, memo: "改" })),
		);
		expect(to).toBe("/products/1");
		expect((await listRecords(t.db, 1))[0]).toMatchObject({ store: "新店", price: 199, quantity: 2, memo: "改" });
		expect(revalidated).toEqual(expect.arrayContaining(["/", "/products/1"]));
	});

	it("リンクとメモを空にできる", async () => {
		const record = await seedRecord({ url: "https://example.com", memo: "元メモ" });
		await expectRedirect(() => updateRecord({}, formData({ ...valid, id: record.id, url: "", memo: "" })));
		const updated = (await listRecords(t.db, 1))[0];
		expect(updated.url).toBeNull();
		expect(updated.memo).toBeNull();
	});

	it("写真を差し替えると旧い画像は消える", async () => {
		await t.bucket.put("products/old.jpg", new Uint8Array(3));
		const record = await seedRecord({ imageKey: "products/old.jpg" });
		await expectRedirect(() => updateRecord({}, formData({ ...valid, id: record.id, image: fakeImage() })));
		const updated = (await listRecords(t.db, 1))[0];
		expect(updated.imageKey).not.toBe("products/old.jpg");
		expect(await r2Keys()).toEqual([updated.imageKey]);
	});

	it("removeImage を付けると写真を消す", async () => {
		await t.bucket.put("products/old.jpg", new Uint8Array(3));
		const record = await seedRecord({ imageKey: "products/old.jpg" });
		await expectRedirect(() => updateRecord({}, formData({ ...valid, id: record.id, removeImage: "on" })));
		expect((await listRecords(t.db, 1))[0].imageKey).toBeNull();
		expect(await r2Keys()).toEqual([]);
	});

	it("商品が同じ写真を使っていれば R2 から消さない", async () => {
		await t.bucket.put("products/shared.jpg", new Uint8Array(3));
		await t.db.update(products).set({ imageKey: "products/shared.jpg" }).where(eq(products.id, 1));
		const record = await seedRecord({ imageKey: "products/shared.jpg" });
		await expectRedirect(() => updateRecord({}, formData({ ...valid, id: record.id, removeImage: "on" })));
		expect((await listRecords(t.db, 1))[0].imageKey).toBeNull();
		expect(await r2Keys()).toEqual(["products/shared.jpg"]);
	});

	it("写真を触らなければそのまま残る", async () => {
		const record = await seedRecord({ imageKey: "products/keep.jpg" });
		await expectRedirect(() => updateRecord({}, formData({ ...valid, id: record.id })));
		expect((await listRecords(t.db, 1))[0].imageKey).toBe("products/keep.jpg");
	});

	it("存在しない記録はエラー", async () => {
		const state = await updateRecord({}, formData({ ...valid, id: 999 }));
		expect(state).toEqual({ error: "価格記録が見つかりません" });
	});

	it("不正な値は検証で弾き、既存の内容を変えない", async () => {
		const record = await seedRecord();
		const state = await updateRecord({}, formData({ ...valid, id: record.id, price: 0 }));
		expect(state.error).toMatch(/1 円以上/);
		expect((await listRecords(t.db, 1))[0].price).toBe(300);
	});
});

describe("deleteRecord", () => {
	it("指定の記録だけ削除する", async () => {
		await t.db.insert(priceRecords).values([
			{ variantId: 1, store: "A", price: 100, quantity: 1, recordedAt: "2026-09-01" },
			{ variantId: 1, store: "B", price: 200, quantity: 1, recordedAt: "2026-09-02" },
		]);
		await deleteRecord(formData({ id: 1, productId: 1 }));
		expect((await listRecords(t.db, 1)).map((r) => r.store)).toEqual(["B"]);
		expect(revalidated).toContain("/products/1");
	});
	it("id が無ければ例外", async () => {
		await expect(deleteRecord(formData({ productId: 1 }))).rejects.toThrow(/^id:/);
	});
});
