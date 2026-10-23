import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sumAsJpy, toRates } from "@/lib/money";
import { createTestEnv, type TestEnv } from "@/test/d1";
import {
  addPhotos,
  setCoverPhoto,
  createComment,
  createEntry,
  createTrip,
  deleteComment,
  deleteEntry,
  deleteTrip,
  getEntry,
  getTrip,
  listComments,
  listEntries,
  listTripPhotoKeys,
  listTrips,
  updateEntry,
  updateTrip,
  upsertUser,
} from "./queries";

let env: TestEnv;

const seedUser = (suffix = "") =>
  upsertUser(env.db, {
    email: `taro${suffix}@example.com`,
    name: `太郎${suffix}`,
    image: null,
  });

const tripInput = {
  name: "台湾旅行",
  currencies: [{ code: "TWD", rateToJpy: 4.7 }],
  areas: [],
};

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
    expect(second.image).toBe("img");
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

describe("trips", () => {
  it("作成した旅行を取得できる", async () => {
    const user = await seedUser();
    const trip = await createTrip(
      env.db,
      { ...tripInput, startDate: "2026-03-01", note: "初 台北" },
      user.id,
    );
    const found = await getTrip(env.db, trip.id);
    expect(found?.name).toBe("台湾旅行");
    expect(found?.currencies).toHaveLength(1);
    expect(found?.currencies[0]?.code).toBe("TWD");
    expect(found?.currencies[0]?.rateToJpy).toBeCloseTo(4.7);
    expect(found?.createdBy).toBe(user.id);
  });

  it("一覧は記録数と合計金額を返す", async () => {
    const user = await seedUser();
    const trip = await createTrip(env.db, tripInput, user.id);
    await createEntry(
      env.db,
      trip.id,
      {
        kind: "food",
        title: "小籠包",
        amountMinor: 20000,
        happenedAt: "2026-03-01T12:00:00Z",
      },
      user.id,
    );
    await createEntry(
      env.db,
      trip.id,
      {
        kind: "shopping",
        title: "パイナップルケーキ",
        amountMinor: 45000,
        happenedAt: "2026-03-01T15:00:00Z",
      },
      user.id,
    );
    // 金額なしの記録は合計に影響しない
    await createEntry(
      env.db,
      trip.id,
      { kind: "other", title: "MRT", happenedAt: "2026-03-01T09:00:00Z" },
      user.id,
    );

    const [summary] = await listTrips(env.db);
    expect(summary.entryCount).toBe(3);
    // 金額のある 2 件だけが合計の対象になる
    expect(summary.amounts).toEqual([
      { minor: 20000, currency: "JPY" },
      { minor: 45000, currency: "JPY" },
    ]);
  });

  it("一覧の金額は記録ごとの通貨を保つ", async () => {
    const user = await seedUser();
    const trip = await createTrip(env.db, tripInput, user.id);
    await createEntry(
      env.db,
      trip.id,
      {
        kind: "food",
        title: "小籠包",
        amountMinor: 20000,
        amountCurrency: "TWD",
        happenedAt: "2026-03-01T12:00:00Z",
      },
      user.id,
    );
    // 日本で先に払った分は円のまま残る
    await createEntry(
      env.db,
      trip.id,
      {
        kind: "other",
        title: "航空券",
        amountMinor: 48000,
        amountCurrency: "JPY",
        happenedAt: "2026-02-01T12:00:00Z",
      },
      user.id,
    );

    const [summary] = await listTrips(env.db);
    expect(summary.amounts).toEqual(
      expect.arrayContaining([
        { minor: 20000, currency: "TWD" },
        { minor: 48000, currency: "JPY" },
      ]),
    );
    // 200 TWD = 940 円 + 48,000 円
    expect(sumAsJpy(summary.amounts, toRates(summary.currencies))).toBe(48940);
  });

  it("通貨が未設定の古い記録は円として扱う", async () => {
    const user = await seedUser();
    const trip = await createTrip(env.db, tripInput, user.id);
    await createEntry(
      env.db,
      trip.id,
      {
        kind: "food",
        title: "移行前の記録",
        amountMinor: 10000,
        happenedAt: "2026-03-01T12:00:00Z",
      },
      user.id,
    );
    const [summary] = await listTrips(env.db);
    expect(summary.amounts).toEqual([{ minor: 10000, currency: "JPY" }]);
  });

  it("1 つの旅行に複数の通貨を登録できる", async () => {
    const user = await seedUser();
    const trip = await createTrip(
      env.db,
      {
        name: "東南アジア周遊",
        currencies: [
          { code: "THB", rateToJpy: 4.3 },
          { code: "VND", rateToJpy: 0.0059 },
        ],
        areas: [],
      },
      user.id,
    );
    const found = await getTrip(env.db, trip.id);
    // 登録した順のまま返る
    expect(found?.currencies.map((c) => c.code)).toEqual(["THB", "VND"]);

    await createEntry(
      env.db,
      trip.id,
      {
        kind: "food",
        title: "ガパオ",
        amountMinor: 12000,
        amountCurrency: "THB",
        happenedAt: "2026-03-01T12:00:00Z",
      },
      user.id,
    );
    await createEntry(
      env.db,
      trip.id,
      {
        kind: "food",
        title: "フォー",
        amountMinor: 60000,
        amountCurrency: "VND",
        happenedAt: "2026-03-05T12:00:00Z",
      },
      user.id,
    );

    const [summary] = await listTrips(env.db);
    // 120 THB = 516 円 + 60,000 VND = 354 円
    expect(sumAsJpy(summary.amounts, toRates(summary.currencies))).toBe(870);
  });

  it("記録が無い旅行も一覧に出る", async () => {
    const user = await seedUser();
    await createTrip(env.db, tripInput, user.id);
    const [summary] = await listTrips(env.db);
    expect(summary.entryCount).toBe(0);
    expect(summary.amounts).toEqual([]);
  });

  it("開始日の新しい順に並ぶ", async () => {
    const user = await seedUser();
    await createTrip(
      env.db,
      { ...tripInput, name: "古い旅", startDate: "2025-01-01" },
      user.id,
    );
    await createTrip(
      env.db,
      { ...tripInput, name: "新しい旅", startDate: "2026-05-01" },
      user.id,
    );
    expect((await listTrips(env.db)).map((t) => t.name)).toEqual([
      "新しい旅",
      "古い旅",
    ]);
  });

  it("更新できる", async () => {
    const user = await seedUser();
    const trip = await createTrip(env.db, tripInput, user.id);
    await updateTrip(env.db, trip.id, {
      name: "韓国旅行",
      currencies: [{ code: "KRW", rateToJpy: 0.11 }],
      areas: [],
    });
    const found = await getTrip(env.db, trip.id);
    expect(found?.name).toBe("韓国旅行");
    // 通貨は入れ替わる（TWD は消えて KRW だけになる）
    expect(found?.currencies.map((c) => c.code)).toEqual(["KRW"]);
    expect(found?.currencies[0]?.rateToJpy).toBeCloseTo(0.11);
    expect(found?.startDate).toBeNull();
  });

  it("削除すると記録・写真・コメントも消える", async () => {
    const user = await seedUser();
    const trip = await createTrip(env.db, tripInput, user.id);
    const entry = await createEntry(
      env.db,
      trip.id,
      { kind: "food", title: "牛肉麺", happenedAt: "2026-03-02T12:00:00Z" },
      user.id,
    );
    await addPhotos(env.db, entry.id, [
      { key: "photos/a.jpg", contentType: "image/jpeg" },
    ]);
    await createComment(
      env.db,
      { entryId: entry.id, body: "美味しそう" },
      user.id,
    );

    expect(await listTripPhotoKeys(env.db, trip.id)).toEqual(["photos/a.jpg"]);

    await deleteTrip(env.db, trip.id);
    expect(await getTrip(env.db, trip.id)).toBeNull();
    expect(await getEntry(env.db, entry.id)).toBeNull();
    expect(await listComments(env.db, entry.id)).toEqual([]);
  });
});

describe("entries", () => {
  it("投稿者と写真とコメント数を一緒に返す", async () => {
    const user = await seedUser();
    const trip = await createTrip(env.db, tripInput, user.id);
    const entry = await createEntry(
      env.db,
      trip.id,
      {
        kind: "food",
        title: "魯肉飯",
        place: "士林夜市",
        amountMinor: 8000,
        rating: 5,
        note: "最高",
        happenedAt: "2026-03-01T18:00:00Z",
      },
      user.id,
    );
    await addPhotos(env.db, entry.id, [
      { key: "photos/a.jpg", contentType: "image/jpeg" },
      { key: "photos/b.jpg", contentType: "image/jpeg" },
    ]);
    await createComment(
      env.db,
      { entryId: entry.id, body: "うまそう" },
      user.id,
    );

    const found = await getEntry(env.db, entry.id);
    expect(found?.title).toBe("魯肉飯");
    expect(found?.rating).toBe(5);
    expect(found?.author.name).toBe("太郎");
    expect(found?.photos.map((p) => p.key)).toEqual([
      "photos/a.jpg",
      "photos/b.jpg",
    ]);
    expect(found?.commentCount).toBe(1);
  });

  it("写真を追加すると既存の並び順の後ろに付く", async () => {
    const user = await seedUser();
    const trip = await createTrip(env.db, tripInput, user.id);
    const entry = await createEntry(
      env.db,
      trip.id,
      { kind: "food", title: "かき氷", happenedAt: "2026-03-01T14:00:00Z" },
      user.id,
    );
    await addPhotos(env.db, entry.id, [
      { key: "photos/1.jpg", contentType: "image/jpeg" },
    ]);
    await addPhotos(env.db, entry.id, [
      { key: "photos/2.jpg", contentType: "image/jpeg" },
    ]);
    const found = await getEntry(env.db, entry.id);
    expect(found?.photos.map((p) => [p.key, p.sortOrder])).toEqual([
      ["photos/1.jpg", 0],
      ["photos/2.jpg", 1],
    ]);
  });

  it("サムネイルにした写真が先頭に来る", async () => {
    const user = await seedUser();
    const trip = await createTrip(env.db, tripInput, user.id);
    const entry = await createEntry(
      env.db,
      trip.id,
      { kind: "food", title: "かき氷", happenedAt: "2026-03-01T14:00:00Z" },
      user.id,
    );
    await addPhotos(env.db, entry.id, [
      { key: "photos/1.jpg", contentType: "image/jpeg" },
      { key: "photos/2.jpg", contentType: "image/jpeg" },
      { key: "photos/3.jpg", contentType: "image/jpeg" },
    ]);
    const before = await getEntry(env.db, entry.id);
    const third = before?.photos[2];

    await setCoverPhoto(env.db, third!.id);

    const found = await getEntry(env.db, entry.id);
    // 残りの写真は元の順番のまま後ろに続く
    expect(found?.photos.map((p) => [p.key, p.sortOrder])).toEqual([
      ["photos/3.jpg", 0],
      ["photos/1.jpg", 1],
      ["photos/2.jpg", 2],
    ]);
  });

  it("すでに先頭の写真をサムネイルにしても並びは変わらない", async () => {
    const user = await seedUser();
    const trip = await createTrip(env.db, tripInput, user.id);
    const entry = await createEntry(
      env.db,
      trip.id,
      { kind: "food", title: "かき氷", happenedAt: "2026-03-01T14:00:00Z" },
      user.id,
    );
    await addPhotos(env.db, entry.id, [
      { key: "photos/1.jpg", contentType: "image/jpeg" },
      { key: "photos/2.jpg", contentType: "image/jpeg" },
    ]);
    const before = await getEntry(env.db, entry.id);

    await setCoverPhoto(env.db, before!.photos[0].id);

    const found = await getEntry(env.db, entry.id);
    expect(found?.photos.map((p) => p.key)).toEqual([
      "photos/1.jpg",
      "photos/2.jpg",
    ]);
  });

  it("存在しない写真を指しても落ちない", async () => {
    await expect(setCoverPhoto(env.db, 999)).resolves.toBeUndefined();
  });

  it("エリアを登録・更新できる（残るエリアの id は変えない）", async () => {
    const user = await seedUser();
    const trip = await createTrip(
      env.db,
      { ...tripInput, areas: ["ミラノ", "ピサ"] },
      user.id,
    );
    const before = await getTrip(env.db, trip.id);
    expect(before?.areas.map((a) => a.name)).toEqual(["ミラノ", "ピサ"]);

    const milan = before!.areas[0];
    await updateTrip(env.db, trip.id, {
      ...tripInput,
      areas: ["ミラノ", "ローマ"],
    });

    const after = await getTrip(env.db, trip.id);
    expect(after?.areas.map((a) => a.name)).toEqual(["ミラノ", "ローマ"]);
    // 記録が指しているので、残った「ミラノ」の id は変わってはいけない
    expect(after?.areas[0].id).toBe(milan.id);
  });

  it("エリアを消しても、そのエリアの記録は残る", async () => {
    const user = await seedUser();
    const trip = await createTrip(
      env.db,
      { ...tripInput, areas: ["ミラノ"] },
      user.id,
    );
    const area = (await getTrip(env.db, trip.id))!.areas[0];
    const entry = await createEntry(
      env.db,
      trip.id,
      {
        kind: "food",
        title: "ピザ",
        areaId: area.id,
        happenedAt: "2026-03-01T12:00:00Z",
      },
      user.id,
    );

    await updateTrip(env.db, trip.id, { ...tripInput, areas: [] });

    const found = await getEntry(env.db, entry.id);
    expect(found?.title).toBe("ピザ");
    expect(found?.areaId).toBeNull();
  });

  it("エリアで絞り込める", async () => {
    const user = await seedUser();
    const trip = await createTrip(
      env.db,
      { ...tripInput, areas: ["ミラノ", "ピサ"] },
      user.id,
    );
    const [milan, pisa] = (await getTrip(env.db, trip.id))!.areas;
    await createEntry(
      env.db,
      trip.id,
      {
        kind: "food",
        title: "ピザ",
        areaId: milan.id,
        happenedAt: "2026-03-01T12:00:00Z",
      },
      user.id,
    );
    await createEntry(
      env.db,
      trip.id,
      {
        kind: "food",
        title: "ジェラート",
        areaId: pisa.id,
        happenedAt: "2026-03-02T12:00:00Z",
      },
      user.id,
    );
    // エリア未設定の記録も混ぜる
    await createEntry(
      env.db,
      trip.id,
      { kind: "other", title: "電車", happenedAt: "2026-03-02T09:00:00Z" },
      user.id,
    );

    const inMilan = await listEntries(env.db, trip.id, { areaId: milan.id });
    expect(inMilan.map((e) => e.title)).toEqual(["ピザ"]);
    expect(await listEntries(env.db, trip.id)).toHaveLength(3);
  });

  it("種別と評価で絞り込める", async () => {
    const user = await seedUser();
    const trip = await createTrip(env.db, tripInput, user.id);
    await createEntry(
      env.db,
      trip.id,
      {
        kind: "food",
        title: "A",
        rating: 5,
        happenedAt: "2026-03-01T10:00:00Z",
      },
      user.id,
    );
    await createEntry(
      env.db,
      trip.id,
      {
        kind: "food",
        title: "B",
        rating: 2,
        happenedAt: "2026-03-01T11:00:00Z",
      },
      user.id,
    );
    await createEntry(
      env.db,
      trip.id,
      {
        kind: "shopping",
        title: "C",
        rating: 5,
        happenedAt: "2026-03-01T12:00:00Z",
      },
      user.id,
    );

    expect(
      (await listEntries(env.db, trip.id, { kind: "food" })).map(
        (e) => e.title,
      ),
    ).toEqual(["B", "A"]);
    expect(
      (await listEntries(env.db, trip.id, { minRating: 5 })).map(
        (e) => e.title,
      ),
    ).toEqual(["C", "A"]);
    expect(
      (await listEntries(env.db, trip.id, { kind: "food", minRating: 5 })).map(
        (e) => e.title,
      ),
    ).toEqual(["A"]);
  });

  it("新しい記録が先に並ぶ", async () => {
    const user = await seedUser();
    const trip = await createTrip(env.db, tripInput, user.id);
    await createEntry(
      env.db,
      trip.id,
      { kind: "food", title: "朝", happenedAt: "2026-03-01T08:00:00Z" },
      user.id,
    );
    await createEntry(
      env.db,
      trip.id,
      { kind: "food", title: "夜", happenedAt: "2026-03-01T20:00:00Z" },
      user.id,
    );
    expect((await listEntries(env.db, trip.id)).map((e) => e.title)).toEqual([
      "夜",
      "朝",
    ]);
  });

  it("更新しても投稿者は変わらない", async () => {
    const user = await seedUser();
    const other = await seedUser("2");
    const trip = await createTrip(env.db, tripInput, user.id);
    const entry = await createEntry(
      env.db,
      trip.id,
      { kind: "food", title: "豆花", happenedAt: "2026-03-01T16:00:00Z" },
      other.id,
    );
    await updateEntry(env.db, entry.id, {
      kind: "shopping",
      title: "豆花（お土産）",
      happenedAt: "2026-03-01T16:00:00Z",
    });
    const found = await getEntry(env.db, entry.id);
    expect(found?.title).toBe("豆花（お土産）");
    expect(found?.kind).toBe("shopping");
    expect(found?.author.id).toBe(other.id);
  });

  it("削除できる", async () => {
    const user = await seedUser();
    const trip = await createTrip(env.db, tripInput, user.id);
    const entry = await createEntry(
      env.db,
      trip.id,
      { kind: "food", title: "臭豆腐", happenedAt: "2026-03-01T19:00:00Z" },
      user.id,
    );
    await deleteEntry(env.db, entry.id);
    expect(await getEntry(env.db, entry.id)).toBeNull();
  });
});

describe("comments", () => {
  const seedEntry = async () => {
    const user = await seedUser();
    const trip = await createTrip(env.db, tripInput, user.id);
    const entry = await createEntry(
      env.db,
      trip.id,
      { kind: "food", title: "マンゴー", happenedAt: "2026-03-01T13:00:00Z" },
      user.id,
    );
    return { user, entry };
  };

  it("投稿者つきで古い順に返す", async () => {
    const { user, entry } = await seedEntry();
    await createComment(env.db, { entryId: entry.id, body: "1 つめ" }, user.id);
    await createComment(env.db, { entryId: entry.id, body: "2 つめ" }, user.id);
    const list = await listComments(env.db, entry.id);
    expect(list.map((c) => c.body)).toEqual(["1 つめ", "2 つめ"]);
    expect(list[0].author.email).toBe("taro@example.com");
  });

  it("返信は parentId を持つ", async () => {
    const { user, entry } = await seedEntry();
    const parent = await createComment(
      env.db,
      { entryId: entry.id, body: "親" },
      user.id,
    );
    const reply = await createComment(
      env.db,
      { entryId: entry.id, parentId: parent.id, body: "返信" },
      user.id,
    );
    expect(reply.parentId).toBe(parent.id);
  });

  it("親を消すと返信も消える", async () => {
    const { user, entry } = await seedEntry();
    const parent = await createComment(
      env.db,
      { entryId: entry.id, body: "親" },
      user.id,
    );
    await createComment(
      env.db,
      { entryId: entry.id, parentId: parent.id, body: "返信" },
      user.id,
    );
    const keep = await createComment(
      env.db,
      { entryId: entry.id, body: "別スレ" },
      user.id,
    );

    await deleteComment(env.db, parent.id);
    const rest = await listComments(env.db, entry.id);
    expect(rest.map((c) => c.id)).toEqual([keep.id]);
  });
});
