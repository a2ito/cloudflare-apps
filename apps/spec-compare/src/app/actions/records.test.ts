import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { expectRedirect, revalidated } from "@/test/action-mocks";
import { createTestEnv, formData, type TestEnv } from "@/test/d1";
import { categories, priceRecords, products } from "@/db/schema";
import { listCompareItems, listRecords } from "@/db/queries";

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
	revalidated.length = 0;
	await t.db.insert(categories).values({ name: "PC" });
	await t.db.insert(products).values([
		{ categoryId: 1, name: "A" },
		{ categoryId: 1, name: "B" },
	]);
});

const record = (fields: Record<string, string | number> = {}) =>
	formData({ productId: 1, store: "Amazon", price: 150000, recordedAt: "2026-10-12", ...fields });

describe("createRecord", () => {
	it("記録して、比較表の最安値に反映する", async () => {
		expect(await createRecord({}, record())).toEqual({ success: "価格を記録しました" });
		await createRecord({}, record({ store: "ヨドバシ", price: 140000, url: "https://example.com/a" }));
		const [a] = await listCompareItems(t.db, 1);
		expect(a.best).toMatchObject({ store: "ヨドバシ", price: 140000, url: "https://example.com/a" });
		expect(revalidated).toEqual(expect.arrayContaining(["/products/1", "/categories/1"]));
	});

	it("中古の記録は、中古を含めたときだけ最安値になる", async () => {
		await createRecord({}, record());
		await createRecord({}, record({ store: "じゃんぱら", price: 90000, used: "1" }));
		expect((await listRecords(t.db, 1)).map((r) => [r.store, r.used])).toEqual([
			["じゃんぱら", true],
			["Amazon", false],
		]);
		expect((await listCompareItems(t.db, 1))[0].best).toMatchObject({ store: "Amazon", used: false });
		expect((await listCompareItems(t.db, 1, true))[0].best).toMatchObject({ store: "じゃんぱら", used: true });
	});

	it("日付と URL を検証する", async () => {
		expect((await createRecord({}, record({ recordedAt: "2026-02-30" }))).error).toMatch(/日付/);
		expect((await createRecord({}, record({ url: "javascript:alert(1)" }))).error).toMatch(/http/);
	});

	it("無い商品には記録しない", async () => {
		expect(await createRecord({}, record({ productId: 99 }))).toEqual({ error: "商品が見つかりません" });
	});
});

describe("updateRecord", () => {
	it("書き換えて商品ページへ戻る", async () => {
		await t.db.insert(priceRecords).values({ productId: 1, store: "A", price: 1, recordedAt: "2026-10-01" });
		const to = await expectRedirect(() => updateRecord({}, record({ id: 1, price: 2 })));
		expect(to).toBe("/products/1");
		expect((await listRecords(t.db, 1))[0]).toMatchObject({ store: "Amazon", price: 2, recordedAt: "2026-10-12" });
	});

	it("中古のチェックを外すと新品に戻る", async () => {
		await t.db.insert(priceRecords).values({ productId: 1, store: "A", price: 1, used: true, recordedAt: "2026-10-01" });
		await expectRedirect(() => updateRecord({}, record({ id: 1 })));
		expect((await listRecords(t.db, 1))[0].used).toBe(false);
	});

	it("別の商品の記録は書き換えない", async () => {
		await t.db.insert(priceRecords).values({ productId: 2, store: "A", price: 1, recordedAt: "2026-10-01" });
		expect(await updateRecord({}, record({ id: 1 }))).toEqual({ error: "価格の記録が見つかりません" });
		expect((await listRecords(t.db, 2))[0].price).toBe(1);
	});
});

describe("deleteRecord", () => {
	it("商品が合うときだけ消す", async () => {
		await t.db.insert(priceRecords).values({ productId: 1, store: "A", price: 1, recordedAt: "2026-10-01" });
		await deleteRecord(formData({ id: 1, productId: 2 }));
		expect(await listRecords(t.db, 1)).toHaveLength(1);
		await deleteRecord(formData({ id: 1, productId: 1 }));
		expect(await listRecords(t.db, 1)).toEqual([]);
	});
});
