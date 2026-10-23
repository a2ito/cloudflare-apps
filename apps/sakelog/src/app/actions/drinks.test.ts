import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getDrink, listDrinks, upsertUser } from "@/db/queries";
import { expectRedirect, revalidated } from "@/test/action-mocks";
import { createTestEnv, fakeImage, formData, type TestEnv } from "@/test/d1";

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
const { deleteDrinkAction, deletePhotoAction, saveDrink, setCoverPhotoAction } =
  await import("./drinks");

beforeAll(async () => {
  t = await createTestEnv();
});
afterAll(() => t.dispose());
beforeEach(async () => {
  await t.truncate();
  await upsertUser(t.db, {
    email: "tester@example.com",
    name: "Tester",
    image: null,
  });
  revalidated.length = 0;
});

const valid = { name: "シャトー・マルゴー", category: "wine" };

describe("saveDrink", () => {
  it("記録して詳細ページへ遷移する", async () => {
    const to = await expectRedirect(() =>
      saveDrink(
        {},
        formData({
          ...valid,
          maker: "Château Margaux",
          style: "赤",
          year: "2018",
          abv: "13.5",
          ingredients: "カベルネ・ソーヴィニヨン, メルロー",
          price: "12000",
          shop: "エノテカ 銀座店",
          drunkAt: "2026-09-20",
          ratingOverall: 5,
          ratingAroma: 4,
          note: "30 分で開く",
        }),
      ),
    );
    expect(to).toBe("/drinks/1");

    const drink = await getDrink(t.db, 1);
    expect(drink).toMatchObject({
      name: "シャトー・マルゴー",
      maker: "Château Margaux",
      category: "wine",
      style: "赤",
      year: 2018,
      abv: 13.5,
      priceMinor: 12000,
      priceCurrency: "JPY",
      drunkAt: "2026-09-20",
      ratingOverall: 5,
      authorId: 1,
    });
    expect(drink?.ingredients.map((i) => i.name)).toEqual([
      "カベルネ・ソーヴィニヨン",
      "メルロー",
    ]);
    expect(revalidated).toEqual(expect.arrayContaining(["/", "/drinks/1"]));
  });

  it("銘柄と種類だけでも保存できる", async () => {
    await expectRedirect(() => saveDrink({}, formData(valid)));
    expect(await getDrink(t.db, 1)).toMatchObject({
      name: "シャトー・マルゴー",
      drunkAt: null,
      priceMinor: null,
    });
  });

  it("知らない種類は受け付けない", async () => {
    const state = await saveDrink(
      {},
      formData({ ...valid, category: "juice" }),
    );
    expect(state.error).toBeTruthy();
    expect(await getDrink(t.db, 1)).toBeNull();
  });

  describe("種類ごとの項目", () => {
    it("その種類の項目を保存する", async () => {
      await expectRedirect(() =>
        saveDrink(
          {},
          formData({
            name: "而今",
            category: "sake",
            style: "純米吟醸",
            polishingRate: "50",
            sakeMeterValue: "+1.5",
            acidity: "1.4",
          }),
        ),
      );
      expect(await getDrink(t.db, 1)).toMatchObject({
        polishingRate: 50,
        sakeMeterValue: 1.5,
        acidity: 1.4,
      });
    });

    it("その種類で意味を持たない項目は捨てる（種類をまたいで値が残らない）", async () => {
      await expectRedirect(() =>
        saveDrink(
          {},
          formData({
            name: "よなよな",
            category: "beer",
            ibu: "45",
            polishingRate: "50",
          }),
        ),
      );
      expect(await getDrink(t.db, 1)).toMatchObject({
        ibu: 45,
        polishingRate: null,
      });
    });

    it("範囲の外や数値でない値は弾く", async () => {
      expect(
        (
          await saveDrink(
            {},
            formData({ name: "A", category: "sake", polishingRate: "150" }),
          )
        ).error,
      ).toMatch(/精米歩合/);
      expect(
        (
          await saveDrink(
            {},
            formData({ name: "A", category: "beer", ibu: "とても苦い" }),
          )
        ).error,
      ).toMatch(/IBU/);
      expect(
        (
          await saveDrink(
            {},
            formData({ name: "A", category: "sake", polishingRate: "50.5" }),
          )
        ).error,
      ).toMatch(/整数/);
      expect(await getDrink(t.db, 1)).toBeNull();
    });

    it("選択肢の項目は候補にある値だけ通す", async () => {
      expect(
        (
          await saveDrink(
            {},
            formData({ name: "A", category: "shochu", distillation: "超高圧" }),
          )
        ).error,
      ).toMatch(/蒸留/);

      await expectRedirect(() =>
        saveDrink(
          {},
          formData({ name: "A", category: "shochu", distillation: "常圧" }),
        ),
      );
      expect(await getDrink(t.db, 1)).toMatchObject({ distillation: "常圧" });
    });
  });

  it("年を持たない種類では年を保存しない", async () => {
    await expectRedirect(() =>
      saveDrink(
        {},
        formData({ name: "よなよな", category: "beer", year: "2026" }),
      ),
    );
    expect(await getDrink(t.db, 1)).toMatchObject({ year: null });
  });

  it("将来や大昔の年は打ち間違いとして弾く", async () => {
    const future = String(new Date().getFullYear() + 1);
    expect(
      (await saveDrink({}, formData({ ...valid, year: future }))).error,
    ).toMatch(/ヴィンテージ/);
    expect(
      (
        await saveDrink(
          {},
          formData({ ...valid, category: "whisky", year: "1800" }),
        )
      ).error,
    ).toMatch(/蒸留年/);
    expect(await getDrink(t.db, 1)).toBeNull();
  });

  it("度数は 0〜100 の範囲で受ける", async () => {
    expect(
      (await saveDrink({}, formData({ ...valid, abv: "120" }))).error,
    ).toMatch(/度数/);
    await expectRedirect(() =>
      saveDrink({}, formData({ ...valid, abv: "13.5" })),
    );
    expect(await getDrink(t.db, 1)).toMatchObject({ abv: 13.5 });
  });

  it("価格は選んだ通貨の最小単位で保存する", async () => {
    await expectRedirect(() =>
      saveDrink(
        {},
        formData({ ...valid, price: "12.34", priceCurrency: "eur" }),
      ),
    );
    expect(await getDrink(t.db, 1)).toMatchObject({
      priceMinor: 1234,
      priceCurrency: "EUR",
    });
  });

  it("価格が無ければ通貨も残さない（意味の無い値を残さない）", async () => {
    await expectRedirect(() =>
      saveDrink({}, formData({ ...valid, priceCurrency: "EUR" })),
    );
    expect(await getDrink(t.db, 1)).toMatchObject({
      priceMinor: null,
      priceCurrency: null,
    });
  });

  it("評価の 0 は「未評価」として null で保存する", async () => {
    await expectRedirect(() =>
      saveDrink({}, formData({ ...valid, ratingOverall: 0, ratingTaste: 3 })),
    );
    expect(await getDrink(t.db, 1)).toMatchObject({
      ratingOverall: null,
      ratingTaste: 3,
    });
  });

  it("銘柄が空なら保存しない", async () => {
    const state = await saveDrink({}, formData({ ...valid, name: "  " }));
    expect(state.error).toBeTruthy();
    expect(await getDrink(t.db, 1)).toBeNull();
  });

  it("https 以外の店の URL は弾く（リンクとして出すため）", async () => {
    const state = await saveDrink(
      {},
      formData({ ...valid, shopUrl: "javascript:alert(1)" }),
    );
    expect(state.error).toMatch(/https/);
    expect(await getDrink(t.db, 1)).toBeNull();
  });

  it("日付として読めない飲んだ日は弾く", async () => {
    const state = await saveDrink(
      {},
      formData({ ...valid, drunkAt: "2026-02-30" }),
    );
    expect(state.error).toMatch(/飲んだ日/);
  });

  it("既存の記録を更新する（新しい行を作らない）", async () => {
    await expectRedirect(() =>
      saveDrink({}, formData({ ...valid, ingredients: "メルロー" })),
    );
    await expectRedirect(() =>
      saveDrink(
        {},
        formData({ ...valid, id: 1, name: "別の銘柄", ingredients: "シラー" }),
      ),
    );

    expect(await listDrinks(t.db)).toHaveLength(1);
    const drink = await getDrink(t.db, 1);
    expect(drink?.name).toBe("別の銘柄");
    expect(drink?.ingredients.map((i) => i.name)).toEqual(["シラー"]);
  });

  it("無い記録の更新は保存しない", async () => {
    const state = await saveDrink({}, formData({ ...valid, id: 999 }));
    expect(state.error).toMatch(/見つかりません/);
  });

  it("写真を R2 に置き、キーを DB に残す", async () => {
    const fd = formData(valid);
    fd.append("photos", fakeImage());
    await expectRedirect(() => saveDrink({}, fd));

    const drink = await getDrink(t.db, 1);
    expect(drink?.photos).toHaveLength(1);
    expect(drink?.photos[0].key).toMatch(/^drinks\/1\//);
    expect(await t.bucket.get(drink!.photos[0].key)).not.toBeNull();
  });
});

describe("deleteDrinkAction", () => {
  it("記録と R2 の写真を消して一覧へ戻る", async () => {
    const fd = formData(valid);
    fd.append("photos", fakeImage());
    await expectRedirect(() => saveDrink({}, fd));
    const key = (await getDrink(t.db, 1))!.photos[0].key;

    const to = await expectRedirect(() =>
      deleteDrinkAction(formData({ id: 1 })),
    );
    expect(to).toBe("/");
    expect(await getDrink(t.db, 1)).toBeNull();
    // 外部キーの cascade では R2 は消えないので、アクション側で消せているかを見る
    expect(await t.bucket.get(key)).toBeNull();
  });
});

describe("写真の操作", () => {
  async function seedTwoPhotos() {
    const fd = formData(valid);
    fd.append("photos", fakeImage("image/jpeg", 1024, "1.jpg"));
    fd.append("photos", fakeImage("image/jpeg", 1024, "2.jpg"));
    await expectRedirect(() => saveDrink({}, fd));
    return (await getDrink(t.db, 1))!.photos;
  }

  it("サムネにした写真が先頭へ来る", async () => {
    const photos = await seedTwoPhotos();
    await setCoverPhotoAction(formData({ id: photos[1].id }));
    expect((await getDrink(t.db, 1))?.photos[0].id).toBe(photos[1].id);
  });

  it("写真を消すと R2 の実体も消える", async () => {
    const photos = await seedTwoPhotos();
    await deletePhotoAction(formData({ id: photos[0].id }));

    expect((await getDrink(t.db, 1))?.photos.map((p) => p.id)).toEqual([
      photos[1].id,
    ]);
    expect(await t.bucket.get(photos[0].key)).toBeNull();
  });
});
