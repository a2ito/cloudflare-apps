import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { expectRedirect, revalidated } from "@/test/action-mocks";
import { createTestEnv, formData, type TestEnv } from "@/test/d1";
import { getVariant, listRecords, listVariants } from "@/db/queries";
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
const { createVariant, deleteVariant, updateVariant } = await import("./variants");

beforeAll(async () => {
	t = await createTestEnv();
});
afterAll(() => t.dispose());
beforeEach(async () => {
	await t.truncate();
	await t.db.insert(products).values([
		{ name: "リステリン", unit: "ml" },
		{ name: "別の商品", unit: "ml" },
	]);
	await t.db.insert(variants).values([
		{ productId: 1, amount: 1000 },
		{ productId: 2, amount: 500 },
	]);
	revalidated.length = 0;
});

async function r2Keys(): Promise<string[]> {
	return (await t.bucket.list()).objects.map((o) => o.key);
}

describe("createVariant", () => {
	it("荷姿を追加して成功メッセージを返す", async () => {
		const state = await createVariant({}, formData({ productId: 1, amount: 350, count: 6 }));
		expect(state).toEqual({ success: "荷姿を追加しました" });
		expect((await listVariants(t.db, 1)).map((v) => [v.amount, v.count])).toEqual([
			[1000, 1],
			[350, 6],
		]);
		expect(revalidated).toEqual(expect.arrayContaining(["/", "/products/1"]));
	});

	it("入数を省略すると 1", async () => {
		await createVariant({}, formData({ productId: 1, amount: 3000 }));
		expect(await getVariant(t.db, 3)).toMatchObject({ amount: 3000, count: 1 });
	});

	it.each([
		["容量が 0", { amount: 0 }, /0 より大きい/],
		["入数が小数", { amount: 100, count: "1.5" }, /整数/],
		["入数が 0", { amount: 100, count: 0 }, /1 以上/],
	])("%s なら検証エラー", async (_label, patch, pattern) => {
		const state = await createVariant({}, formData({ productId: 1, ...patch }));
		expect(state.error).toMatch(pattern);
		expect(await listVariants(t.db, 1)).toHaveLength(1);
	});
});

describe("updateVariant", () => {
	it("容量と入数を更新して詳細へ戻る", async () => {
		const to = await expectRedirect(() => updateVariant({}, formData({ id: 1, productId: 1, amount: 350, count: 6 })));
		expect(to).toBe("/products/1");
		expect(await getVariant(t.db, 1)).toMatchObject({ amount: 350, count: 6 });
		expect(revalidated).toEqual(expect.arrayContaining(["/", "/products/1"]));
	});

	it("別の商品の荷姿は書き換えない", async () => {
		const state = await updateVariant({}, formData({ id: 2, productId: 1, amount: 1, count: 1 }));
		expect(state).toEqual({ error: "荷姿が見つかりません" });
		expect(await getVariant(t.db, 2)).toMatchObject({ amount: 500 });
	});
});

describe("deleteVariant", () => {
	beforeEach(async () => {
		await t.db.insert(variants).values({ productId: 1, amount: 3000 });
	});

	it("荷姿と価格記録を削除し、記録の写真も R2 から消す", async () => {
		await t.bucket.put("products/r.jpg", new Uint8Array(3));
		await t.db.insert(priceRecords).values([
			{ variantId: 3, store: "コストコ", price: 2728, quantity: 1, recordedAt: "2026-09-12", imageKey: "products/r.jpg" },
			{ variantId: 1, store: "アオキ", price: 1078, quantity: 1, recordedAt: "2026-09-12" },
		]);

		await deleteVariant(formData({ id: 3, productId: 1 }));
		expect((await listVariants(t.db, 1)).map((v) => v.id)).toEqual([1]);
		expect(await listRecords(t.db, 3)).toEqual([]);
		expect(await listRecords(t.db, 1)).toHaveLength(1);
		expect(await r2Keys()).toEqual([]);
		expect(revalidated).toContain("/products/1");
	});

	it("他の行が同じ写真を使っていれば R2 から消さない", async () => {
		await t.bucket.put("products/shared.jpg", new Uint8Array(3));
		await t.db.insert(priceRecords).values([
			{ variantId: 3, store: "a", price: 100, quantity: 1, recordedAt: "2026-09-12", imageKey: "products/shared.jpg" },
			{ variantId: 1, store: "b", price: 100, quantity: 1, recordedAt: "2026-09-12", imageKey: "products/shared.jpg" },
		]);
		await deleteVariant(formData({ id: 3, productId: 1 }));
		expect(await r2Keys()).toEqual(["products/shared.jpg"]);
	});

	it("最後の荷姿は削除できない", async () => {
		await expect(deleteVariant(formData({ id: 2, productId: 2 }))).rejects.toThrow(/最後の荷姿は削除できません/);
		expect(await getVariant(t.db, 2)).not.toBeNull();
	});

	it("別の商品の荷姿は削除しない", async () => {
		await deleteVariant(formData({ id: 2, productId: 1 }));
		expect(await getVariant(t.db, 2)).not.toBeNull();
	});
});
