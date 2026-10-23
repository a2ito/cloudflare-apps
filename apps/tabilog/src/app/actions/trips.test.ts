import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getTrip, listTrips, upsertUser } from "@/db/queries";
import { expectRedirect, revalidated } from "@/test/action-mocks";
import { createTestEnv, formData, type TestEnv } from "@/test/d1";

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
const { deleteTripAction, saveTrip } = await import("./trips");

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

const valid = {
  name: "台湾旅行",
  startDate: "2026-03-01",
  endDate: "2026-03-05",
};

/** 通貨は 1 行 = (currencyCode, currencyRate) の組で送る */
function tripForm(
  fields: Record<string, string | number | undefined>,
  currencies: [string, string][] = [["twd", "4.7"]],
  areas: string[] = [],
) {
  const fd = formData(fields);
  for (const [code, rate] of currencies) {
    fd.append("currencyCode", code);
    fd.append("currencyRate", rate);
  }
  for (const area of areas) fd.append("areaName", area);
  return fd;
}

describe("saveTrip", () => {
  it("作成して詳細ページへ遷移する", async () => {
    const to = await expectRedirect(() => saveTrip({}, tripForm(valid)));
    expect(to).toBe("/trips/1");

    const trip = await getTrip(t.db, 1);
    expect(trip).toMatchObject({ name: "台湾旅行", startDate: "2026-03-01" });
    // 通貨コードは大文字に揃える
    expect(trip?.currencies.map((c) => c.code)).toEqual(["TWD"]);
    expect(trip?.currencies[0]?.rateToJpy).toBeCloseTo(4.7);
    expect(revalidated).toEqual(expect.arrayContaining(["/", "/trips/1"]));
  });

  it("通貨を複数登録できる（並べた順のまま）", async () => {
    await expectRedirect(() =>
      saveTrip(
        {},
        tripForm(valid, [
          ["thb", "4.3"],
          ["vnd", "0.0059"],
        ]),
      ),
    );
    const trip = await getTrip(t.db, 1);
    expect(trip?.currencies.map((c) => c.code)).toEqual(["THB", "VND"]);
  });

  it("円は主通貨なので保存しない", async () => {
    await expectRedirect(() =>
      saveTrip(
        {},
        tripForm(valid, [
          ["JPY", "1"],
          ["TWD", "4.7"],
        ]),
      ),
    );
    expect((await getTrip(t.db, 1))?.currencies.map((c) => c.code)).toEqual([
      "TWD",
    ]);
  });

  it("通貨を 1 つも選ばない旅行も作れる", async () => {
    await expectRedirect(() => saveTrip({}, tripForm(valid, [])));
    expect((await getTrip(t.db, 1))?.currencies).toEqual([]);
  });

  it("選んでいない行（通貨コードが空）は無視する", async () => {
    await expectRedirect(() =>
      saveTrip(
        {},
        tripForm(valid, [
          ["TWD", "4.7"],
          ["", ""],
        ]),
      ),
    );
    expect((await getTrip(t.db, 1))?.currencies.map((c) => c.code)).toEqual([
      "TWD",
    ]);
  });

  it("同じ通貨が重複しているとエラー", async () => {
    const state = await saveTrip(
      {},
      tripForm(valid, [
        ["TWD", "4.7"],
        ["twd", "4.8"],
      ]),
    );
    expect(state.error).toMatch(/重複/);
    expect(await listTrips(t.db)).toHaveLength(0);
  });

  it("既存の旅行を更新すると通貨も入れ替わる", async () => {
    await expectRedirect(() => saveTrip({}, tripForm(valid)));
    await expectRedirect(() =>
      saveTrip(
        {},
        tripForm({ ...valid, id: 1, name: "台湾旅行（改）" }, [
          ["KRW", "0.11"],
        ]),
      ),
    );
    const trip = await getTrip(t.db, 1);
    expect(trip?.name).toBe("台湾旅行（改）");
    expect(trip?.currencies.map((c) => c.code)).toEqual(["KRW"]);
    expect(await listTrips(t.db)).toHaveLength(1);
  });

  it.each([
    ["旅行名が空", { name: "" }, undefined, /旅行名を入力/],
    ["通貨コードが 3 文字でない", {}, [["JPYY", "1"]], /通貨コード/],
    ["レートが 0", {}, [["TWD", "0"]], /換算レート/],
    ["レートが空欄", {}, [["TWD", ""]], /換算レート/],
    ["日付の形式が不正", { startDate: "2026/03/01" }, undefined, /日付の形式/],
    [
      "終了日が開始日より前",
      { startDate: "2026-03-05", endDate: "2026-03-01" },
      undefined,
      /終了日/,
    ],
  ] as [
    string,
    Record<string, string>,
    [string, string][] | undefined,
    RegExp,
  ][])(
    "%s なら保存せずエラーを返す",
    async (_name, override, currencies, pattern) => {
      const state = await saveTrip(
        {},
        tripForm({ ...valid, ...override }, currencies),
      );
      expect(state.error).toMatch(pattern);
      expect(await listTrips(t.db)).toHaveLength(0);
    },
  );

  it("エリアを登録できる（並べた順のまま）", async () => {
    await expectRedirect(() =>
      saveTrip({}, tripForm(valid, undefined, ["ミラノ", "ピサ", "ローマ"])),
    );
    const trip = await getTrip(t.db, 1);
    expect(trip?.areas.map((a) => a.name)).toEqual([
      "ミラノ",
      "ピサ",
      "ローマ",
    ]);
  });

  it("空欄のエリアは無視し、前後の空白は落とす", async () => {
    await expectRedirect(() =>
      saveTrip({}, tripForm(valid, undefined, [" ミラノ ", "", "  "])),
    );
    expect((await getTrip(t.db, 1))?.areas.map((a) => a.name)).toEqual([
      "ミラノ",
    ]);
  });

  it("同じエリア名が重複しているとエラー", async () => {
    const state = await saveTrip(
      {},
      tripForm(valid, undefined, ["ミラノ", "ミラノ"]),
    );
    expect(state.error).toMatch(/重複/);
    expect(await listTrips(t.db)).toHaveLength(0);
  });

  it("存在しない旅行の更新はエラー", async () => {
    const state = await saveTrip({}, tripForm({ ...valid, id: 999 }));
    expect(state.error).toMatch(/見つかりません/);
  });
});

describe("deleteTripAction", () => {
  it("削除して一覧へ戻る", async () => {
    await expectRedirect(() => saveTrip({}, tripForm(valid)));
    const to = await expectRedirect(() =>
      deleteTripAction(formData({ id: 1 })),
    );
    expect(to).toBe("/");
    expect(await getTrip(t.db, 1)).toBeNull();
  });

  it("ID が不正なら例外", async () => {
    await expect(deleteTripAction(formData({ id: "abc" }))).rejects.toThrow(
      /ID/,
    );
  });
});
