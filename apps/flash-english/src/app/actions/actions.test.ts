import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createDeck,
  getSentence,
  listDecksWithStats,
  listSentences,
  upsertUser,
} from "@/db/queries";
import { revalidated } from "@/test/action-mocks";
import { createTestEnv, formData, type TestEnv } from "@/test/d1";

let t: TestEnv;
vi.mock("@/lib/auth", async () => ({
  requireUser: async () => (await import("@/test/action-mocks")).fakeUser,
}));
vi.mock("@/lib/cloudflare", () => ({ getEnv: () => Promise.resolve(t.env) }));
vi.mock("@/lib/date", async (orig) => ({
  ...(await orig<typeof import("@/lib/date")>()),
  today: () => "2026-10-12",
}));
vi.mock("next/cache", async () => {
  const { revalidated } = await import("@/test/action-mocks");
  return { revalidatePath: (p: string) => void revalidated.push(p) };
});
// redirect は本物だと例外で処理を抜けるので、行き先だけ記録して例外を投げ直す
const redirected: string[] = [];
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirected.push(to);
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
const { addDeck, deleteDeckAction, renameDeckAction } = await import("./decks");
const {
  addSentence,
  addSentencesBulk,
  deleteSentenceAction,
  updateSentenceAction,
} = await import("./sentences");
const { recordReviewAction } = await import("./practice");

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
  redirected.length = 0;
});

async function myDeck(name = "章1") {
  const deck = await createDeck(t.db, 1, name);
  if (!deck) throw new Error("セットを作れなかった");
  return deck.id;
}

describe("decks", () => {
  it("セットを作る。同じ名前は断る", async () => {
    expect(await addDeck({}, formData({ name: " 章1 " }))).toEqual({
      success: "「章1」を作りました",
    });
    expect(await addDeck({}, formData({ name: "章1" }))).toEqual({
      error: "「章1」は既にあります",
    });
    expect(await addDeck({}, formData({ name: "" }))).toEqual({
      error: "セット名を入力してください",
    });
    expect(revalidated).toContain("/");
  });

  it("名前を変える", async () => {
    const id = await myDeck();
    expect(
      await renameDeckAction({}, formData({ id, name: "Lesson 1" })),
    ).toEqual({ success: "名前を変えました" });
    expect(
      (await listDecksWithStats(t.db, 1, "2026-10-12")).map((d) => d.name),
    ).toEqual(["Lesson 1"]);
  });

  it("消して一覧へ戻る", async () => {
    const id = await myDeck();
    await expect(deleteDeckAction(formData({ id }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(redirected).toEqual(["/"]);
    expect(await listDecksWithStats(t.db, 1, "2026-10-12")).toEqual([]);
  });
});

describe("sentences", () => {
  it("1 文を登録する。空のメモは null にする", async () => {
    const deckId = await myDeck();
    expect(
      await addSentence(
        {},
        formData({
          deckId,
          ja: "私は学生です。",
          en: "I am a student.",
          note: "",
        }),
      ),
    ).toEqual({ success: "登録しました" });
    expect(await listSentences(t.db, 1, deckId)).toMatchObject([
      {
        ja: "私は学生です。",
        en: "I am a student.",
        note: null,
        dueOn: "2026-10-12",
      },
    ]);
    expect(revalidated).toContain(`/decks/${deckId}`);
  });

  it.each([
    [{ ja: " " }, "日本文を入力してください"],
    [{ en: "" }, "英文を入力してください"],
    [{ en: "a".repeat(501) }, "英文は 500 文字までです"],
  ])("不正な入力 %o は登録しない", async (override, error) => {
    const deckId = await myDeck();
    expect(
      await addSentence(
        {},
        formData({ deckId, ja: "あ", en: "a", ...override }),
      ),
    ).toEqual({ error });
    expect(await listSentences(t.db, 1, deckId)).toEqual([]);
  });

  it("他人のセットには登録できない", async () => {
    const other = await upsertUser(t.db, {
      email: "other@example.com",
      name: null,
      image: null,
    });
    const theirs = await createDeck(t.db, other.id, "他人");
    expect(
      await addSentence(
        {},
        formData({ deckId: theirs!.id, ja: "あ", en: "a" }),
      ),
    ).toEqual({ error: "セットが見つかりません" });
  });

  it("まとめて登録する。崩れた行があれば何も登録しない", async () => {
    const deckId = await myDeck();
    expect(
      await addSentencesBulk({}, formData({ deckId, text: "あ\tA\nい" })),
    ).toEqual({ error: "2 行目: 日本文と英文をタブで区切ってください" });
    expect(await listSentences(t.db, 1, deckId)).toEqual([]);
    expect(
      await addSentencesBulk({}, formData({ deckId, text: "あ\tA\nい\tI" })),
    ).toEqual({ success: "2 文を登録しました" });
    expect((await listSentences(t.db, 1, deckId)).map((s) => s.en)).toEqual([
      "A",
      "I",
    ]);
  });

  it("直してセットの画面へ戻る", async () => {
    const deckId = await myDeck();
    await addSentence({}, formData({ deckId, ja: "あ", en: "a" }));
    const [s] = await listSentences(t.db, 1, deckId);
    await expect(
      updateSentenceAction(
        {},
        formData({ id: s.id, deckId, ja: "あ", en: "A", note: "大文字" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirected).toEqual([`/decks/${deckId}`]);
    expect(await getSentence(t.db, 1, s.id)).toMatchObject({
      en: "A",
      note: "大文字",
    });
  });

  it("消す", async () => {
    const deckId = await myDeck();
    await addSentence({}, formData({ deckId, ja: "あ", en: "a" }));
    const [s] = await listSentences(t.db, 1, deckId);
    await deleteSentenceAction(formData({ id: s.id, deckId }));
    expect(await listSentences(t.db, 1, deckId)).toEqual([]);
  });
});

describe("recordReviewAction", () => {
  it("○×を今日の日付で記録する", async () => {
    const deckId = await myDeck();
    await addSentence({}, formData({ deckId, ja: "あ", en: "a" }));
    const [s] = await listSentences(t.db, 1, deckId);
    await recordReviewAction(s.id, true);
    expect(await getSentence(t.db, 1, s.id)).toMatchObject({
      streak: 1,
      dueOn: "2026-10-13",
      lastReviewedOn: "2026-10-12",
    });
  });

  it.each([
    ["1", true],
    [1, "true"],
    [-1, true],
  ])(
    "ブラウザから不正な値（%o, %o）で呼ばれたら記録しない",
    async (id, correct) => {
      await expect(recordReviewAction(id, correct)).rejects.toThrow(
        "記録する内容が不正です",
      );
    },
  );

  it("無い文なら失敗を知らせる", async () => {
    await expect(recordReviewAction(999, true)).rejects.toThrow(
      "文が見つかりません",
    );
  });
});
