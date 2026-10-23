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
import { categories, products } from "@/db/schema";
import { listCategories } from "@/db/queries";

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
const { createCategory, deleteCategory, renameCategory } =
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
  it("追加して成功メッセージを返す", async () => {
    const state = await createCategory({}, formData({ name: " 飲料 " }));
    expect(state).toEqual({ success: "「飲料」を追加しました" });
    expect((await listCategories(t.db)).map((c) => c.name)).toEqual(["飲料"]);
    expect(revalidated).toContain("/categories");
  });
  it("空文字は検証エラー", async () => {
    const state = await createCategory({}, formData({ name: "   " }));
    expect(state.error).toMatch(/カテゴリ名を入力/);
  });
  it("重複は分かりやすいエラーにする", async () => {
    await createCategory({}, formData({ name: "飲料" }));
    const state = await createCategory({}, formData({ name: "飲料" }));
    expect(state).toEqual({ error: "「飲料」は既に存在します" });
  });
});

describe("renameCategory", () => {
  it("名前を変更する", async () => {
    await t.db.insert(categories).values({ name: "旧" });
    const state = await renameCategory({}, formData({ id: 1, name: "新" }));
    expect(state).toEqual({ success: "変更しました" });
    expect((await listCategories(t.db))[0].name).toBe("新");
    expect(revalidated).toEqual(expect.arrayContaining(["/categories", "/"]));
  });
  it("他カテゴリと同名にはできない", async () => {
    await t.db.insert(categories).values([{ name: "A" }, { name: "B" }]);
    const state = await renameCategory({}, formData({ id: 2, name: "A" }));
    expect(state.error).toBe("「A」は既に存在します");
  });
  it("id が不正なら検証エラー", async () => {
    const state = await renameCategory({}, formData({ id: "x", name: "A" }));
    expect(state.error).toMatch(/^id:/);
  });
});

describe("deleteCategory", () => {
  it("削除すると所属商品は未分類になる", async () => {
    await t.db.insert(categories).values({ name: "飲料" });
    await t.db
      .insert(products)
      .values({ name: "豆乳", categoryId: 1, unit: "ml" });
    await deleteCategory(formData({ id: 1 }));
    expect(await listCategories(t.db)).toEqual([]);
    const [p] = await t.db.select().from(products);
    expect(p.categoryId).toBeNull();
  });
  it("不正な id は例外", async () => {
    await expect(deleteCategory(formData({ id: "0" }))).rejects.toThrow(/^id:/);
  });
});
