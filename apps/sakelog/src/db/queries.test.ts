import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv, type TestEnv } from "@/test/d1";
import {
  addPhotos,
  countByCategory,
  createDrink,
  deleteDrink,
  deletePhoto,
  getDrink,
  getPhoto,
  listDrinkPhotoKeys,
  listDrinks,
  listIngredientNames,
  setCoverPhoto,
  updateDrink,
  upsertUser,
  type DrinkInput,
} from "./queries";

let env: TestEnv;

const seedUser = (suffix = "") =>
  upsertUser(env.db, {
    email: `taro${suffix}@example.com`,
    name: `太郎${suffix}`,
    image: null,
  });

const drinkInput = (overrides: Partial<DrinkInput> = {}): DrinkInput => ({
  name: "シャトー・マルゴー",
  category: "wine",
  ingredients: [],
  specifics: {},
  ...overrides,
});

afterAll(async () => env?.dispose());
beforeEach(async () => {
  env ??= await createTestEnv();
  await env.truncate();
});

describe("upsertUser", () => {
  it("初回は作成し、2 回目は同じ行を更新する", async () => {
    const first = await upsertUser(env.db, {
      email: "Taro@Example.com",
      name: "太郎",
      image: null,
    });
    const second = await upsertUser(env.db, {
      email: "taro@example.com",
      name: "太郎（改）",
      image: "img",
    });
    expect(second.id).toBe(first.id);
    expect(second.name).toBe("太郎（改）");
  });

  it("メールは小文字で保存される", async () => {
    const user = await upsertUser(env.db, {
      email: " TARO@Example.com ",
      name: null,
      image: null,
    });
    expect(user.email).toBe("taro@example.com");
  });
});

describe("drinks", () => {
  it("記録した内容をそのまま取り出せる", async () => {
    const user = await seedUser();
    const drink = await createDrink(
      env.db,
      drinkInput({
        maker: "Château Margaux",
        style: "赤",
        year: 2018,
        abv: 13.5,
        country: "フランス",
        region: "ボルドー",
        priceMinor: 120000,
        priceCurrency: "JPY",
        shop: "エノテカ 銀座店",
        drunkAt: "2026-09-20",
        ratingOverall: 5,
        ratingValue: 3,
        note: "30 分で開く",
        ingredients: ["カベルネ・ソーヴィニヨン", "メルロー"],
      }),
      user.id,
    );

    const found = await getDrink(env.db, drink.id);
    expect(found).toMatchObject({
      name: "シャトー・マルゴー",
      category: "wine",
      style: "赤",
      year: 2018,
      abv: 13.5,
      priceMinor: 120000,
      drunkAt: "2026-09-20",
      ratingOverall: 5,
      authorId: user.id,
    });
    // 材料は書いた順に並ぶ（ブレンドの主体が先に来る）
    expect(found?.ingredients.map((i) => i.name)).toEqual([
      "カベルネ・ソーヴィニヨン",
      "メルロー",
    ]);
    expect(found?.author.email).toBe(user.email);
  });

  it("種類ごとの項目を保存できる", async () => {
    const user = await seedUser();
    const sake = await createDrink(
      env.db,
      drinkInput({
        name: "而今",
        category: "sake",
        style: "純米吟醸",
        specifics: { polishingRate: 50, sakeMeterValue: 1.5, acidity: 1.4 },
      }),
      user.id,
    );
    const whisky = await createDrink(
      env.db,
      drinkInput({
        name: "山崎",
        category: "whisky",
        specifics: { agedYears: 12, caskType: "シェリー" },
      }),
      user.id,
    );

    expect(await getDrink(env.db, sake.id)).toMatchObject({
      polishingRate: 50,
      sakeMeterValue: 1.5,
      acidity: 1.4,
    });
    expect(await getDrink(env.db, whisky.id)).toMatchObject({
      agedYears: 12,
      caskType: "シェリー",
    });
    // 渡さなかった種類の項目は null のまま（種類をまたいで値が残らない）
    expect(await getDrink(env.db, whisky.id)).toMatchObject({
      polishingRate: null,
      ibu: null,
    });
  });

  it("付けなかった評価は null のまま（0 と区別する）", async () => {
    const user = await seedUser();
    const drink = await createDrink(
      env.db,
      drinkInput({ ratingOverall: 4 }),
      user.id,
    );
    const found = await getDrink(env.db, drink.id);
    expect(found?.ratingOverall).toBe(4);
    expect(found?.ratingAroma).toBeNull();
  });

  it("更新で材料を入れ替えられる", async () => {
    const user = await seedUser();
    const drink = await createDrink(
      env.db,
      drinkInput({ ingredients: ["メルロー", "シラー"] }),
      user.id,
    );
    await updateDrink(
      env.db,
      drink.id,
      drinkInput({ name: "別の銘柄", ingredients: ["ピノ・ノワール"] }),
    );

    const found = await getDrink(env.db, drink.id);
    expect(found?.name).toBe("別の銘柄");
    expect(found?.ingredients.map((i) => i.name)).toEqual(["ピノ・ノワール"]);
  });

  it("更新で種類を変えると、前の種類の固有項目は消える", async () => {
    const user = await seedUser();
    const drink = await createDrink(
      env.db,
      drinkInput({ category: "sake", specifics: { polishingRate: 50 } }),
      user.id,
    );
    await updateDrink(
      env.db,
      drink.id,
      drinkInput({ category: "beer", specifics: { ibu: 45 } }),
    );

    expect(await getDrink(env.db, drink.id)).toMatchObject({
      category: "beer",
      ibu: 45,
      polishingRate: null,
    });
  });

  it("削除すると材料と写真の行も消える", async () => {
    const user = await seedUser();
    const drink = await createDrink(
      env.db,
      drinkInput({ ingredients: ["メルロー"] }),
      user.id,
    );
    await addPhotos(env.db, drink.id, [
      { key: "drinks/1/a.jpg", contentType: "image/jpeg" },
    ]);

    expect(await listDrinkPhotoKeys(env.db, drink.id)).toEqual([
      "drinks/1/a.jpg",
    ]);
    await deleteDrink(env.db, drink.id);

    expect(await getDrink(env.db, drink.id)).toBeNull();
    expect(await listDrinkPhotoKeys(env.db, drink.id)).toEqual([]);
    expect(await listIngredientNames(env.db)).toEqual([]);
  });
});

describe("listDrinks", () => {
  async function seedMixed() {
    const user = await seedUser();
    await createDrink(
      env.db,
      drinkInput({
        name: "赤A",
        drunkAt: "2026-01-01",
        ratingOverall: 5,
        priceMinor: 3000,
        ingredients: ["メルロー"],
      }),
      user.id,
    );
    await createDrink(
      env.db,
      drinkInput({
        name: "IPA B",
        category: "beer",
        style: "IPA",
        drunkAt: "2026-05-01",
        ratingOverall: 3,
        priceMinor: 9000,
        maker: "うちゅうブルーイング",
        ingredients: ["シトラ"],
      }),
      user.id,
    );
    // まだ飲んでいない 1 本
    await createDrink(
      env.db,
      drinkInput({
        name: "而今",
        category: "sake",
        ratingOverall: 4,
        shop: "カクヤス",
        ingredients: ["山田錦"],
      }),
      user.id,
    );
    return user;
  }

  it("既定は飲んだ日の新しい順で、未開栓は末尾に置く", async () => {
    await seedMixed();
    expect((await listDrinks(env.db)).map((d) => d.name)).toEqual([
      "IPA B",
      "赤A",
      "而今",
    ]);
  });

  it("評価順・価格順に並べ替えられる（未入力は末尾）", async () => {
    await seedMixed();
    expect((await listDrinks(env.db, {}, "rating")).map((d) => d.name)).toEqual(
      ["赤A", "而今", "IPA B"],
    );
    expect((await listDrinks(env.db, {}, "price")).map((d) => d.name)).toEqual([
      "IPA B",
      "赤A",
      "而今",
    ]);
  });

  it("種類と評価で絞り込める", async () => {
    await seedMixed();
    expect(
      (await listDrinks(env.db, { category: "beer" })).map((d) => d.name),
    ).toEqual(["IPA B"]);
    expect(
      (await listDrinks(env.db, { minRating: 4 })).map((d) => d.name),
    ).toEqual(["赤A", "而今"]);
  });

  it("材料で絞り込める（大文字小文字は区別しない）", async () => {
    const user = await seedUser();
    await createDrink(
      env.db,
      drinkInput({ name: "A", ingredients: ["Citra"] }),
      user.id,
    );
    await createDrink(
      env.db,
      drinkInput({ name: "B", ingredients: ["山田錦"] }),
      user.id,
    );
    expect(
      (await listDrinks(env.db, { ingredient: "citra" })).map((d) => d.name),
    ).toEqual(["A"]);
  });

  it("検索は銘柄・造り手・分類・購入場所・材料のどれに当たっても拾う", async () => {
    await seedMixed();
    expect(
      (await listDrinks(env.db, { q: "うちゅう" })).map((d) => d.name),
    ).toEqual(["IPA B"]);
    expect(
      (await listDrinks(env.db, { q: "カクヤス" })).map((d) => d.name),
    ).toEqual(["而今"]);
    expect(
      (await listDrinks(env.db, { q: "山田錦" })).map((d) => d.name),
    ).toEqual(["而今"]);
    expect((await listDrinks(env.db, { q: "ipa" })).map((d) => d.name)).toEqual(
      ["IPA B"],
    );
    expect(await listDrinks(env.db, { q: "存在しない" })).toEqual([]);
  });

  it("絞り込みは重ねられる", async () => {
    await seedMixed();
    expect(
      (await listDrinks(env.db, { category: "wine", minRating: 5 })).map(
        (d) => d.name,
      ),
    ).toEqual(["赤A"]);
  });
});

describe("listIngredientNames", () => {
  it("記録の多い材料から並べ、種類でも絞れる（絞り込みの選択肢に使う）", async () => {
    const user = await seedUser();
    await createDrink(
      env.db,
      drinkInput({ name: "A", ingredients: ["メルロー", "シラー"] }),
      user.id,
    );
    await createDrink(
      env.db,
      drinkInput({ name: "B", ingredients: ["メルロー"] }),
      user.id,
    );
    await createDrink(
      env.db,
      drinkInput({ name: "C", category: "sake", ingredients: ["山田錦"] }),
      user.id,
    );

    expect(await listIngredientNames(env.db)).toEqual([
      "メルロー",
      "シラー",
      "山田錦",
    ]);
    expect(await listIngredientNames(env.db, "sake")).toEqual(["山田錦"]);
  });
});

describe("countByCategory", () => {
  it("種類ごとの件数を返す（一覧のタブに出す）", async () => {
    const user = await seedUser();
    await createDrink(env.db, drinkInput({ name: "A" }), user.id);
    await createDrink(env.db, drinkInput({ name: "B" }), user.id);
    await createDrink(
      env.db,
      drinkInput({ name: "C", category: "beer" }),
      user.id,
    );

    const counts = await countByCategory(env.db);
    expect(counts.get("wine")).toBe(2);
    expect(counts.get("beer")).toBe(1);
    expect(counts.get("gin")).toBeUndefined();
  });
});

describe("photos", () => {
  async function seedWithPhotos() {
    const user = await seedUser();
    const drink = await createDrink(env.db, drinkInput(), user.id);
    await addPhotos(env.db, drink.id, [
      { key: "drinks/1/1.jpg", contentType: "image/jpeg" },
      { key: "drinks/1/2.jpg", contentType: "image/jpeg" },
    ]);
    return drink;
  }

  it("あとから足した写真は末尾に付く", async () => {
    const drink = await seedWithPhotos();
    await addPhotos(env.db, drink.id, [
      { key: "drinks/1/3.jpg", contentType: "image/jpeg" },
    ]);
    const found = await getDrink(env.db, drink.id);
    expect(found?.photos.map((p) => p.key)).toEqual([
      "drinks/1/1.jpg",
      "drinks/1/2.jpg",
      "drinks/1/3.jpg",
    ]);
  });

  it("サムネにした写真が先頭へ来る", async () => {
    const drink = await seedWithPhotos();
    const second = (await getDrink(env.db, drink.id))!.photos[1];
    await setCoverPhoto(env.db, second.id);

    const found = await getDrink(env.db, drink.id);
    expect(found?.photos.map((p) => p.key)).toEqual([
      "drinks/1/2.jpg",
      "drinks/1/1.jpg",
    ]);
    // 並び順は 0 から振り直す（削除を繰り返しても値が離れていかない）
    expect(found?.photos.map((p) => p.sortOrder)).toEqual([0, 1]);
  });

  it("写真を消しても残りは並んだまま", async () => {
    const drink = await seedWithPhotos();
    const first = (await getDrink(env.db, drink.id))!.photos[0];
    await deletePhoto(env.db, first.id);

    expect(await getPhoto(env.db, first.id)).toBeNull();
    expect(
      (await getDrink(env.db, drink.id))?.photos.map((p) => p.key),
    ).toEqual(["drinks/1/2.jpg"]);
  });
});
