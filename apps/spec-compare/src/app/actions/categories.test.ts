import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { expectRedirect, revalidated } from "@/test/action-mocks";
import { createTestEnv, formData, type TestEnv } from "@/test/d1";
import { categories, products, specFields } from "@/db/schema";
import { listCategories, listFields } from "@/db/queries";

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
const { createCategory, deleteCategory, renameCategory, setDefaultCostField } =
  await import("./categories");

beforeAll(async () => {
  t = await createTestEnv();
});
afterAll(() => t.dispose());
beforeEach(async () => {
  await t.truncate();
  revalidated.length = 0;
});

describe("createCategory", () => {
  it("作って比較表へ移る", async () => {
    const to = await expectRedirect(() =>
      createCategory({}, formData({ name: " ノート PC " })),
    );
    expect(to).toBe("/categories/1");
    expect((await listCategories(t.db)).map((c) => c.name)).toEqual([
      "ノート PC",
    ]);
    expect(await listFields(t.db, 1)).toEqual([]);
  });

  it("ひな形を選ぶとスペック項目を並び順つきで入れる", async () => {
    await expectRedirect(() =>
      createCategory({}, formData({ name: "PC", preset: "laptop" })),
    );
    const fields = await listFields(t.db, 1);
    expect(fields.map((f) => f.name)).toEqual([
      "CPU",
      "メモリ",
      "ストレージ",
      "画面サイズ",
      "重量",
      "バッテリー",
    ]);
    expect(fields[1]).toMatchObject({
      unit: "GB",
      kind: "number",
      better: "higher",
      position: 1,
    });
  });

  it("知らないひな形は無視する", async () => {
    await expectRedirect(() =>
      createCategory({}, formData({ name: "PC", preset: "unknown" })),
    );
    expect(await listFields(t.db, 1)).toEqual([]);
  });

  it("同じ名前は分かりやすいエラーにする", async () => {
    await t.db.insert(categories).values({ name: "PC" });
    expect(await createCategory({}, formData({ name: "PC" }))).toEqual({
      error: "「PC」は既に存在します",
    });
  });
});

describe("renameCategory", () => {
  it("名前を変える", async () => {
    await t.db.insert(categories).values({ name: "旧" });
    expect(await renameCategory({}, formData({ id: 1, name: "新" }))).toEqual({
      success: "変更しました",
    });
    expect((await listCategories(t.db))[0].name).toBe("新");
    expect(revalidated).toContain("/");
  });
});

describe("setDefaultCostField", () => {
  beforeEach(async () => {
    await t.db.insert(categories).values([{ name: "PC" }, { name: "スマホ" }]);
    await t.db.insert(specFields).values([
      {
        categoryId: 1,
        name: "メモリ",
        unit: "GB",
        kind: "number",
        better: "higher",
      },
      {
        categoryId: 1,
        name: "重量",
        unit: "kg",
        kind: "number",
        better: "lower",
      },
      {
        categoryId: 2,
        name: "AnTuTu",
        unit: "点",
        kind: "number",
        better: "higher",
      },
    ]);
  });
  const defaultOf = async (id: number) =>
    (await listCategories(t.db)).find((c) => c.id === id)?.defaultCostFieldId;

  it("大きいほど良い数値の項目を既定にし、空なら外す", async () => {
    expect(
      await setDefaultCostField({}, formData({ id: 1, fieldId: 1 })),
    ).toEqual({ success: "変更しました" });
    expect(await defaultOf(1)).toBe(1);
    await setDefaultCostField({}, formData({ id: 1, fieldId: "" }));
    expect(await defaultOf(1)).toBeNull();
  });

  it("コスパにならない項目や別のカテゴリの項目は選ばせない", async () => {
    expect(
      (await setDefaultCostField({}, formData({ id: 1, fieldId: 2 }))).error,
    ).toMatch(/大きいほど良い/);
    expect(
      (await setDefaultCostField({}, formData({ id: 1, fieldId: 3 }))).error,
    ).toMatch(/大きいほど良い/);
    expect(await defaultOf(1)).toBeNull();
  });
});

describe("deleteCategory", () => {
  it("商品が無ければスペック項目ごと消す", async () => {
    await t.db.insert(categories).values({ name: "PC" });
    await t.db.insert(specFields).values({ categoryId: 1, name: "メモリ" });
    expect(
      await expectRedirect(() => deleteCategory({}, formData({ id: 1 }))),
    ).toBe("/");
    expect(await listCategories(t.db)).toEqual([]);
    expect(await t.db.select().from(specFields)).toEqual([]);
  });

  it("商品が残っていれば消さない", async () => {
    await t.db.insert(categories).values({ name: "PC" });
    await t.db.insert(products).values({ categoryId: 1, name: "A" });
    expect(await deleteCategory({}, formData({ id: 1 }))).toEqual({
      error: "商品が 1 件残っています。先に商品を削除してください",
    });
    expect(await listCategories(t.db)).toHaveLength(1);
  });
});
