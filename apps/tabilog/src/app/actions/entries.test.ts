import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createTrip, getEntry, listEntries, upsertUser } from "@/db/queries";
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
const { deleteEntryAction, deletePhotoAction, saveEntry, setCoverPhotoAction } =
  await import("./entries");

beforeAll(async () => {
  t = await createTestEnv();
});
afterAll(() => t.dispose());
beforeEach(async () => {
  await t.truncate();
  const user = await upsertUser(t.db, {
    email: "tester@example.com",
    name: "Tester",
    image: null,
  });
  // 現地通貨のある旅行（TWD・THB）と、円だけの旅行を用意する
  await createTrip(
    t.db,
    {
      name: "台湾・タイ旅行",
      currencies: [
        { code: "TWD", rateToJpy: 4.7 },
        { code: "THB", rateToJpy: 4.3 },
      ],
      areas: [],
    },
    user.id,
  );
  await createTrip(
    t.db,
    { name: "国内旅行", currencies: [], areas: [] },
    user.id,
  );
  revalidated.length = 0;
});

const valid = {
  tripId: 1,
  kind: "food",
  title: "小籠包",
  happenedAt: "2026-03-01T12:30",
};

describe("saveEntry", () => {
  it("記録して詳細ページへ遷移する", async () => {
    const to = await expectRedirect(() =>
      saveEntry(
        {},
        formData({
          ...valid,
          place: "鼎泰豐",
          amount: "200",
          amountCurrency: "TWD",
          rating: 5,
          note: "熱々",
        }),
      ),
    );
    expect(to).toBe("/trips/1/entries/1");

    const entry = await getEntry(t.db, 1);
    expect(entry).toMatchObject({
      title: "小籠包",
      place: "鼎泰豐",
      amountMinor: 20000,
      rating: 5,
      note: "熱々",
      happenedAt: "2026-03-01T12:30",
      authorId: 1,
    });
    expect(revalidated).toEqual(
      expect.arrayContaining(["/trips/1", "/trips/1/entries/1"]),
    );
  });

  it("金額は選んだ通貨の最小単位で保存する", async () => {
    await expectRedirect(() =>
      saveEntry(
        {},
        formData({ ...valid, amount: "12.34", amountCurrency: "TWD" }),
      ),
    );
    expect(await getEntry(t.db, 1)).toMatchObject({
      amountMinor: 1234,
      amountCurrency: "TWD",
    });

    await expectRedirect(() =>
      saveEntry({}, formData({ ...valid, tripId: 2, amount: "1200" })),
    );
    expect(await getEntry(t.db, 2)).toMatchObject({
      amountMinor: 1200,
      amountCurrency: "JPY",
    });
  });

  it("旅行に登録した通貨をそれぞれ選べる", async () => {
    await expectRedirect(() =>
      saveEntry(
        {},
        formData({ ...valid, amount: "120", amountCurrency: "THB" }),
      ),
    );
    expect(await getEntry(t.db, 1)).toMatchObject({
      amountMinor: 12000,
      amountCurrency: "THB",
    });
  });

  it("旅行に登録していない通貨は受け付けない", async () => {
    const state = await saveEntry(
      {},
      formData({ ...valid, amount: "100", amountCurrency: "EUR" }),
    );
    expect(state.error).toMatch(/使えない通貨/);
    expect(await getEntry(t.db, 1)).toBeNull();
  });

  it("円は登録していなくても使える", async () => {
    await expectRedirect(() =>
      saveEntry(
        {},
        formData({
          ...valid,
          tripId: 2,
          amount: "1200",
          amountCurrency: "jpy",
        }),
      ),
    );
    expect(await getEntry(t.db, 1)).toMatchObject({
      amountMinor: 1200,
      amountCurrency: "JPY",
    });
  });

  it("日本円を選ぶと円のまま保存する", async () => {
    await expectRedirect(() =>
      saveEntry(
        {},
        formData({ ...valid, amount: "48000", amountCurrency: "JPY" }),
      ),
    );
    expect(await getEntry(t.db, 1)).toMatchObject({
      amountMinor: 48000,
      amountCurrency: "JPY",
    });
  });

  it("日本円を選ぶと円の桁数（小数なし）で解釈する", async () => {
    // TWD なら 100.60 -> 10060 だが、円なら 101
    await expectRedirect(() =>
      saveEntry(
        {},
        formData({ ...valid, amount: "100.6", amountCurrency: "JPY" }),
      ),
    );
    expect((await getEntry(t.db, 1))?.amountMinor).toBe(101);
  });

  it("通貨を指定しなければ円として扱う", async () => {
    await expectRedirect(() =>
      saveEntry({}, formData({ ...valid, amount: "200" })),
    );
    expect((await getEntry(t.db, 1))?.amountCurrency).toBe("JPY");
  });

  it("金額が空なら通貨も残さない", async () => {
    await expectRedirect(() =>
      saveEntry({}, formData({ ...valid, amountCurrency: "JPY" })),
    );
    expect(await getEntry(t.db, 1)).toMatchObject({
      amountMinor: null,
      amountCurrency: null,
    });
  });

  it("円で入れた記録を現地通貨に入れ直せる", async () => {
    await expectRedirect(() =>
      saveEntry(
        {},
        formData({ ...valid, amount: "48000", amountCurrency: "JPY" }),
      ),
    );
    await expectRedirect(() =>
      saveEntry(
        {},
        formData({ ...valid, id: 1, amount: "200", amountCurrency: "TWD" }),
      ),
    );
    expect(await getEntry(t.db, 1)).toMatchObject({
      amountMinor: 20000,
      amountCurrency: "TWD",
    });
  });

  it("旅行に無いエリアは受け付けない", async () => {
    const state = await saveEntry({}, formData({ ...valid, areaId: 999 }));
    expect(state.error).toMatch(/エリア/);
    expect(await getEntry(t.db, 1)).toBeNull();
  });

  it("エリアを指定しなければ未設定で保存する", async () => {
    await expectRedirect(() => saveEntry({}, formData(valid)));
    expect((await getEntry(t.db, 1))?.areaId).toBeNull();
  });

  it("金額と評価は省略できる", async () => {
    await expectRedirect(() => saveEntry({}, formData(valid)));
    const entry = await getEntry(t.db, 1);
    expect(entry?.amountMinor).toBeNull();
    expect(entry?.rating).toBeNull();
  });

  it("「見た」の記録も残せる", async () => {
    await expectRedirect(() =>
      saveEntry(
        {},
        formData({ ...valid, kind: "sightseeing", title: "九份の夜景" }),
      ),
    );
    expect(await getEntry(t.db, 1)).toMatchObject({
      kind: "sightseeing",
      title: "九份の夜景",
    });
    expect(
      (await listEntries(t.db, 1, { kind: "sightseeing" })).map((e) => e.title),
    ).toEqual(["九份の夜景"]);
  });

  it("Google マップの URL を任意で保存する", async () => {
    await expectRedirect(() =>
      saveEntry(
        {},
        formData({ ...valid, mapUrl: " https://maps.app.goo.gl/AbCdEf123 " }),
      ),
    );
    expect((await getEntry(t.db, 1))?.mapUrl).toBe(
      "https://maps.app.goo.gl/AbCdEf123",
    );
  });

  it("URL を空にすると地図を外せる", async () => {
    await expectRedirect(() =>
      saveEntry(
        {},
        formData({ ...valid, mapUrl: "https://maps.app.goo.gl/AbCdEf123" }),
      ),
    );
    await expectRedirect(() =>
      saveEntry({}, formData({ ...valid, id: 1, mapUrl: "" })),
    );
    expect((await getEntry(t.db, 1))?.mapUrl).toBeNull();
  });

  it("写真を R2 に保存して紐づける", async () => {
    const fd = formData(valid);
    fd.append("photos", fakeImage("image/jpeg", 2048, "a.jpg"));
    fd.append("photos", fakeImage("image/png", 2048, "b.png"));
    await expectRedirect(() => saveEntry({}, fd));

    const entry = await getEntry(t.db, 1);
    expect(entry?.photos).toHaveLength(2);
    expect(entry?.photos[0].key).toMatch(/^trips\/1\//);
    expect(await t.bucket.get(entry!.photos[0].key)).not.toBeNull();
  });

  it("対応していない形式の写真は保存しない", async () => {
    const fd = formData(valid);
    fd.append(
      "photos",
      new File([new Uint8Array(10)], "a.pdf", { type: "application/pdf" }),
    );
    const state = await saveEntry({}, fd);
    expect(state.error).toMatch(/対応していない/);
  });

  it("既存の記録を更新し、写真は追記される", async () => {
    const first = formData(valid);
    first.append("photos", fakeImage("image/jpeg", 2048, "a.jpg"));
    await expectRedirect(() => saveEntry({}, first));

    const second = formData({
      ...valid,
      id: 1,
      title: "小籠包（2 回目）",
      rating: 4,
    });
    second.append("photos", fakeImage("image/jpeg", 2048, "b.jpg"));
    await expectRedirect(() => saveEntry({}, second));

    const entry = await getEntry(t.db, 1);
    expect(entry?.title).toBe("小籠包（2 回目）");
    expect(entry?.rating).toBe(4);
    expect(entry?.photos).toHaveLength(2);
    expect(await listEntries(t.db, 1)).toHaveLength(1);
  });

  it.each([
    ["タイトルが空", { title: "" }, /入力してください/],
    ["種別が不正", { kind: "drink" }, /kind/],
    ["日時の形式が不正", { happenedAt: "2026-03-01" }, /日時の形式/],
    ["存在しない日時", { happenedAt: "2026-02-30T12:00" }, /日時の形式/],
    ["金額が数値でない", { amount: "たかい" }, /金額/],
    ["評価が範囲外", { rating: 9 }, /rating/],
    [
      "通貨コードの形が不正",
      { amount: "100", amountCurrency: "TWDD" },
      /通貨コード/,
    ],
    [
      "旅行に無い通貨",
      { amount: "100", amountCurrency: "USD" },
      /使えない通貨/,
    ],
    [
      "地図が Google マップ以外の URL",
      { mapUrl: "https://example.com/maps" },
      /Google マップ/,
    ],
    [
      "地図がリンクにできない文字列",
      { mapUrl: "javascript:alert(1)" },
      /Google マップ/,
    ],
  ])("%s なら保存せずエラーを返す", async (_name, override, pattern) => {
    const state = await saveEntry({}, formData({ ...valid, ...override }));
    expect(state.error).toMatch(pattern);
    expect(await listEntries(t.db, 1)).toHaveLength(0);
  });

  it("存在しない旅行にはぶら下げられない", async () => {
    const state = await saveEntry({}, formData({ ...valid, tripId: 999 }));
    expect(state.error).toMatch(/旅行が見つかりません/);
  });

  it("別の旅行の記録 ID を渡しても更新できない", async () => {
    await expectRedirect(() => saveEntry({}, formData(valid)));
    const state = await saveEntry({}, formData({ ...valid, tripId: 2, id: 1 }));
    expect(state.error).toMatch(/記録が見つかりません/);
  });
});

describe("deleteEntryAction", () => {
  it("記録と写真の実体を消して旅行ページへ戻る", async () => {
    const fd = formData(valid);
    fd.append("photos", fakeImage("image/jpeg", 2048, "a.jpg"));
    await expectRedirect(() => saveEntry({}, fd));
    const key = (await getEntry(t.db, 1))!.photos[0].key;

    const to = await expectRedirect(() =>
      deleteEntryAction(formData({ id: 1, tripId: 1 })),
    );
    expect(to).toBe("/trips/1");
    expect(await getEntry(t.db, 1)).toBeNull();
    expect(await t.bucket.get(key)).toBeNull();
  });
});

describe("deletePhotoAction", () => {
  it("写真だけを消す", async () => {
    const fd = formData(valid);
    fd.append("photos", fakeImage("image/jpeg", 2048, "a.jpg"));
    fd.append("photos", fakeImage("image/jpeg", 2048, "b.jpg"));
    await expectRedirect(() => saveEntry({}, fd));

    const before = await getEntry(t.db, 1);
    const removed = before!.photos[0];
    await deletePhotoAction(formData({ id: removed.id }));

    const after = await getEntry(t.db, 1);
    expect(after?.photos.map((p) => p.id)).toEqual([before!.photos[1].id]);
    expect(await t.bucket.get(removed.key)).toBeNull();
  });

  it("存在しない写真 ID は無視する", async () => {
    await expect(
      deletePhotoAction(formData({ id: 999 })),
    ).resolves.toBeUndefined();
  });
});

describe("setCoverPhotoAction", () => {
  it("選んだ写真を先頭に移し、一覧を作り直す", async () => {
    const fd = formData(valid);
    fd.append("photos", fakeImage("image/jpeg", 2048, "a.jpg"));
    fd.append("photos", fakeImage("image/jpeg", 2048, "b.jpg"));
    await expectRedirect(() => saveEntry({}, fd));
    revalidated.length = 0;

    const before = await getEntry(t.db, 1);
    const second = before!.photos[1];
    await setCoverPhotoAction(formData({ id: second.id }));

    const after = await getEntry(t.db, 1);
    expect(after?.photos.map((p) => p.id)).toEqual([
      second.id,
      before!.photos[0].id,
    ]);
    // 一覧のサムネイルも変わるので、旅行一覧と旅行ページも作り直す
    expect(revalidated).toEqual(
      expect.arrayContaining(["/", "/trips/1", "/trips/1/entries/1"]),
    );
  });

  it("存在しない写真 ID は無視する", async () => {
    await expect(
      setCoverPhotoAction(formData({ id: 999 })),
    ).resolves.toBeUndefined();
  });

  it("ID が不正なら例外", async () => {
    await expect(setCoverPhotoAction(formData({ id: "abc" }))).rejects.toThrow(
      /写真 ID/,
    );
  });
});
