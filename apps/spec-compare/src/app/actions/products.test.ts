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
import { createTestEnv, fakeImage, formData, type TestEnv } from "@/test/d1";
import {
  categories,
  priceRecords,
  products,
  specFields,
  specValues,
} from "@/db/schema";
import { getProductSpecs, listCompareItems, listRecords } from "@/db/queries";

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
const {
  createProduct,
  deleteProduct,
  setProductFavorite,
  setProductHidden,
  setProductSoldOut,
  updateProduct,
} = await import("./products");

beforeAll(async () => {
  t = await createTestEnv();
});
afterAll(() => t.dispose());
beforeEach(async () => {
  await t.truncate();
  revalidated.length = 0;
  await t.db.insert(categories).values([{ name: "PC" }, { name: "モニター" }]);
  await t.db.insert(specFields).values([
    { categoryId: 1, name: "CPU", kind: "text" },
    {
      categoryId: 1,
      name: "メモリ",
      unit: "GB",
      kind: "number",
      better: "higher",
    },
    { categoryId: 2, name: "サイズ", kind: "number" },
  ]);
});

describe("createProduct", () => {
  it("スペックと最初の価格をまとめて登録する", async () => {
    const to = await expectRedirect(() =>
      createProduct(
        {},
        formData({
          categoryId: 1,
          name: "PC-A",
          maker: "X",
          spec_1: "M4",
          spec_2: "16",
          store: "Amazon",
          price: "150000",
        }),
      ),
    );
    expect(to).toBe("/products/1");
    const [item] = await listCompareItems(t.db, 1);
    expect(item).toMatchObject({
      name: "PC-A",
      maker: "X",
      best: { store: "Amazon", price: 150000 },
    });
    expect(item.specs).toEqual({
      1: { num: null, text: "M4" },
      2: { num: 16, text: null },
    });
    expect(revalidated).toContain("/categories/1");
  });

  it("価格は任意", async () => {
    await expectRedirect(() =>
      createProduct({}, formData({ categoryId: 1, name: "PC-A" })),
    );
    expect(await listRecords(t.db, 1)).toEqual([]);
  });

  it("店舗と価格は片方だけでは受け付けない", async () => {
    expect(
      await createProduct(
        {},
        formData({ categoryId: 1, name: "PC-A", store: "Amazon" }),
      ),
    ).toEqual({
      error: "最初の価格は、店舗と価格をそろえて入れてください",
    });
    expect(await t.db.select().from(products)).toEqual([]);
  });

  it("別のカテゴリの項目の値は拾わない", async () => {
    await expectRedirect(() =>
      createProduct(
        {},
        formData({ categoryId: 1, name: "PC-A", spec_3: "27" }),
      ),
    );
    expect(await getProductSpecs(t.db, 1)).toEqual({});
  });

  it("スペックが不正なら画像も保存しない", async () => {
    const state = await createProduct(
      {},
      formData({
        categoryId: 1,
        name: "PC-A",
        spec_2: "たくさん",
        image: fakeImage(),
      }),
    );
    expect(state).toEqual({ error: "「メモリ」は数値で入力してください" });
    expect((await t.bucket.list()).objects).toEqual([]);
  });

  it("項目が多くても D1 のバインド変数の上限に当たらない", async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      categoryId: 2,
      name: `項目${i}`,
      kind: "number" as const,
    }));
    // 下準備の INSERT 自体も上限に当たらないよう、10 項目ずつ入れる
    for (let i = 0; i < many.length; i += 10)
      await t.db.insert(specFields).values(many.slice(i, i + 10));
    const fields = await t.db.select().from(specFields);
    const values = Object.fromEntries(
      fields
        .filter((f) => f.categoryId === 2)
        .map((f) => [`spec_${f.id}`, "1"]),
    );
    await expectRedirect(() =>
      createProduct({}, formData({ categoryId: 2, name: "M", ...values })),
    );
    expect(Object.keys(await getProductSpecs(t.db, 1))).toHaveLength(41);
  });
});

describe("updateProduct", () => {
  beforeEach(async () => {
    await t.db.insert(products).values({ categoryId: 1, name: "PC-A" });
    await t.db.insert(specValues).values([
      { productId: 1, fieldId: 1, valueText: "M3" },
      { productId: 1, fieldId: 2, valueNum: 8 },
    ]);
  });

  it("スペックを入れ替える。空欄にした項目は未入力に戻る", async () => {
    const to = await expectRedirect(() =>
      updateProduct(
        {},
        formData({ id: 1, name: "PC-A2", spec_1: "", spec_2: "24" }),
      ),
    );
    expect(to).toBe("/products/1");
    expect(await getProductSpecs(t.db, 1)).toEqual({
      2: { num: 24, text: null },
    });
    const [p] = await t.db.select().from(products);
    expect(p.name).toBe("PC-A2");
  });

  it("画像を差し替えると古い画像を消す", async () => {
    await expectRedirect(() =>
      updateProduct({}, formData({ id: 1, name: "PC-A", image: fakeImage() })),
    );
    const [first] = await t.db.select().from(products);
    await expectRedirect(() =>
      updateProduct({}, formData({ id: 1, name: "PC-A", image: fakeImage() })),
    );
    const [second] = await t.db.select().from(products);
    expect(second.imageKey).not.toBe(first.imageKey);
    expect(await t.bucket.head(first.imageKey!)).toBeNull();
    expect(await t.bucket.head(second.imageKey!)).not.toBeNull();
  });

  it("画像を削除できる", async () => {
    await expectRedirect(() =>
      updateProduct({}, formData({ id: 1, name: "PC-A", image: fakeImage() })),
    );
    const [withImage] = await t.db.select().from(products);
    await expectRedirect(() =>
      updateProduct({}, formData({ id: 1, name: "PC-A", removeImage: "on" })),
    );
    const [p] = await t.db.select().from(products);
    expect(p.imageKey).toBeNull();
    expect(await t.bucket.head(withImage.imageKey!)).toBeNull();
  });

  it("無い商品はエラー", async () => {
    expect(await updateProduct({}, formData({ id: 99, name: "x" }))).toEqual({
      error: "商品が見つかりません",
    });
  });
});

describe("setProductFavorite", () => {
  it("お気に入りを付け外しできる", async () => {
    await expectRedirect(() =>
      createProduct({}, formData({ categoryId: 1, name: "PC-A" })),
    );
    expect((await listCompareItems(t.db, 1))[0].favorite).toBe(false);
    await setProductFavorite(formData({ id: 1, favorite: "1" }));
    expect((await listCompareItems(t.db, 1))[0].favorite).toBe(true);
    expect(revalidated).toEqual(
      expect.arrayContaining(["/categories/1", "/products/1"]),
    );
    await setProductFavorite(formData({ id: 1, favorite: "0" }));
    expect((await listCompareItems(t.db, 1))[0].favorite).toBe(false);
  });

  it("無い商品はエラー", async () => {
    await expect(
      setProductFavorite(formData({ id: 99, favorite: "1" })),
    ).rejects.toThrow(/見つかりません/);
  });
});

describe("setProductHidden", () => {
  it("比較表から隠し、戻せる。価格の記録は消さない", async () => {
    await expectRedirect(() =>
      createProduct(
        {},
        formData({ categoryId: 1, name: "PC-A", store: "A", price: "1" }),
      ),
    );
    await setProductHidden(formData({ id: 1, hidden: "1" }));
    expect((await listCompareItems(t.db, 1))[0]).toMatchObject({
      hidden: true,
      best: { price: 1 },
    });
    expect(revalidated).toEqual(
      expect.arrayContaining(["/categories/1", "/products/1"]),
    );
    await setProductHidden(formData({ id: 1, hidden: "0" }));
    expect((await listCompareItems(t.db, 1))[0].hidden).toBe(false);
  });

  it("無い商品はエラー", async () => {
    await expect(
      setProductHidden(formData({ id: 99, hidden: "1" })),
    ).rejects.toThrow(/見つかりません/);
  });
});

describe("setProductSoldOut", () => {
  it("売り切れにし、戻せる。非表示とは別に持つ", async () => {
    await expectRedirect(() =>
      createProduct(
        {},
        formData({ categoryId: 1, name: "PC-A", store: "A", price: "1" }),
      ),
    );
    await setProductSoldOut(formData({ id: 1, soldOut: "1" }));
    expect((await listCompareItems(t.db, 1))[0]).toMatchObject({
      soldOut: true,
      hidden: false,
      best: { price: 1 },
    });
    expect(revalidated).toEqual(
      expect.arrayContaining(["/categories/1", "/products/1"]),
    );
    await setProductSoldOut(formData({ id: 1, soldOut: "0" }));
    expect((await listCompareItems(t.db, 1))[0].soldOut).toBe(false);
  });

  it("無い商品はエラー", async () => {
    await expect(
      setProductSoldOut(formData({ id: 99, soldOut: "1" })),
    ).rejects.toThrow(/見つかりません/);
  });
});

describe("deleteProduct", () => {
  it("スペック・価格・画像ごと消してカテゴリへ戻る", async () => {
    await expectRedirect(() =>
      createProduct(
        {},
        formData({
          categoryId: 1,
          name: "PC-A",
          spec_2: "16",
          store: "A",
          price: "1",
          image: fakeImage(),
        }),
      ),
    );
    const [p] = await t.db.select().from(products);
    const to = await expectRedirect(() => deleteProduct(formData({ id: 1 })));
    expect(to).toBe("/categories/1");
    expect(await t.db.select().from(products)).toEqual([]);
    expect(await t.db.select().from(specValues)).toEqual([]);
    expect(await t.db.select().from(priceRecords)).toEqual([]);
    expect(await t.bucket.head(p.imageKey!)).toBeNull();
  });
});
