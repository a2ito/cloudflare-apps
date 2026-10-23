import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { revalidated } from "@/test/action-mocks";
import { createTestEnv, formData, type TestEnv } from "@/test/d1";
import { categories, products, specFields, specValues } from "@/db/schema";
import { listFields } from "@/db/queries";

let t: TestEnv;
vi.mock("@/lib/auth", async () => ({
  requireUser: async () => (await import("@/test/action-mocks")).fakeUser,
}));
vi.mock("@/lib/cloudflare", () => ({ getEnv: () => Promise.resolve(t.env) }));
vi.mock("next/cache", async () => {
  const { revalidated } = await import("@/test/action-mocks");
  return { revalidatePath: (p: string) => void revalidated.push(p) };
});
vi.mock("next/navigation", async () => {
  const { RedirectSignal } = await import("@/test/action-mocks");
  return {
    redirect: (to: string) => {
      throw new RedirectSignal(to);
    },
  };
});
const { createField, deleteField, moveField, updateField } =
  await import("./fields");

beforeAll(async () => {
  t = await createTestEnv();
});
afterAll(() => t.dispose());
beforeEach(async () => {
  await t.truncate();
  revalidated.length = 0;
  await t.db.insert(categories).values([{ name: "PC" }, { name: "モニター" }]);
});

describe("createField", () => {
  it("末尾に足す", async () => {
    await createField(
      {},
      formData({
        categoryId: 1,
        name: "メモリ",
        unit: "GB",
        kind: "number",
        better: "higher",
      }),
    );
    const state = await createField(
      {},
      formData({
        categoryId: 1,
        name: "重量",
        unit: "kg",
        kind: "number",
        better: "lower",
      }),
    );
    expect(state).toEqual({ success: "「重量」を追加しました" });
    const fields = await listFields(t.db, 1);
    expect(fields.map((f) => [f.name, f.position])).toEqual([
      ["メモリ", 0],
      ["重量", 1],
    ]);
    expect(revalidated).toContain("/categories/1");
  });

  it("テキストは単位と良し悪しを持たない", async () => {
    await createField(
      {},
      formData({
        categoryId: 1,
        name: "CPU",
        unit: "GHz",
        kind: "text",
        better: "higher",
      }),
    );
    expect((await listFields(t.db, 1))[0]).toMatchObject({
      unit: null,
      better: "none",
    });
  });

  it("同じカテゴリで同じ名前は弾く。別のカテゴリなら作れる", async () => {
    await createField(
      {},
      formData({
        categoryId: 1,
        name: "重量",
        kind: "number",
        better: "lower",
      }),
    );
    expect(
      await createField(
        {},
        formData({
          categoryId: 1,
          name: "重量",
          kind: "number",
          better: "lower",
        }),
      ),
    ).toEqual({ error: "「重量」は既にあります" });
    expect(
      (
        await createField(
          {},
          formData({
            categoryId: 2,
            name: "重量",
            kind: "number",
            better: "lower",
          }),
        )
      ).success,
    ).toBeTruthy();
  });
});

describe("updateField", () => {
  it("名前・単位・向きを変える。型は変えない", async () => {
    await t.db.insert(specFields).values({
      categoryId: 1,
      name: "メモリ",
      unit: "GB",
      kind: "number",
      better: "higher",
    });
    const state = await updateField(
      {},
      formData({
        id: 1,
        categoryId: 1,
        name: "RAM",
        unit: "",
        better: "none",
        kind: "text",
      }),
    );
    expect(state).toEqual({ success: "変更しました" });
    expect((await listFields(t.db, 1))[0]).toMatchObject({
      name: "RAM",
      unit: null,
      kind: "number",
      better: "none",
    });
  });

  it("簡易フィルタに出すかは、チェックがあるときだけオンにする", async () => {
    await t.db.insert(specFields).values({
      categoryId: 1,
      name: "メモリ",
      unit: "GB",
      kind: "number",
      better: "higher",
    });
    await updateField(
      {},
      formData({
        id: 1,
        categoryId: 1,
        name: "メモリ",
        unit: "GB",
        better: "higher",
        quickFilter: "1",
      }),
    );
    expect((await listFields(t.db, 1))[0].quickFilter).toBe(true);
    await updateField(
      {},
      formData({
        id: 1,
        categoryId: 1,
        name: "メモリ",
        unit: "GB",
        better: "higher",
      }),
    );
    expect((await listFields(t.db, 1))[0].quickFilter).toBe(false);
  });

  it("別のカテゴリの項目は変えられない", async () => {
    await t.db.insert(specFields).values({ categoryId: 1, name: "メモリ" });
    expect(
      await updateField(
        {},
        formData({ id: 1, categoryId: 2, name: "x", better: "none" }),
      ),
    ).toEqual({ error: "項目が見つかりません" });
  });
});

describe("deleteField", () => {
  it("入力済みの値ごと消す", async () => {
    await t.db.insert(specFields).values({ categoryId: 1, name: "メモリ" });
    await t.db.insert(products).values({ categoryId: 1, name: "A" });
    await t.db
      .insert(specValues)
      .values({ productId: 1, fieldId: 1, valueNum: 16 });
    await deleteField(formData({ id: 1, categoryId: 1 }));
    expect(await listFields(t.db, 1)).toEqual([]);
    expect(await t.db.select().from(specValues)).toEqual([]);
  });
});

describe("moveField", () => {
  beforeEach(async () => {
    await t.db.insert(specFields).values([
      { categoryId: 1, name: "A", position: 0 },
      { categoryId: 1, name: "B", position: 1 },
      { categoryId: 1, name: "C", position: 2 },
    ]);
  });
  const names = async () => (await listFields(t.db, 1)).map((f) => f.name);

  it("隣と入れ替える", async () => {
    await moveField(formData({ id: 3, categoryId: 1, direction: "up" }));
    expect(await names()).toEqual(["A", "C", "B"]);
    await moveField(formData({ id: 1, categoryId: 1, direction: "down" }));
    expect(await names()).toEqual(["C", "A", "B"]);
  });

  it("端より外へは動かさない", async () => {
    await moveField(formData({ id: 1, categoryId: 1, direction: "up" }));
    await moveField(formData({ id: 3, categoryId: 1, direction: "down" }));
    expect(await names()).toEqual(["A", "B", "C"]);
  });

  it("position が重複していても並べ直せる", async () => {
    await t.db.update(specFields).set({ position: 0 });
    await moveField(formData({ id: 2, categoryId: 1, direction: "up" }));
    expect(await names()).toEqual(["B", "A", "C"]);
  });
});
