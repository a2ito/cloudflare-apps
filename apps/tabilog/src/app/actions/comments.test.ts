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
  createEntry,
  createTrip,
  listComments,
  upsertUser,
} from "@/db/queries";
import { buildThreads } from "@/lib/comments";
import { revalidated } from "@/test/action-mocks";
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
const { addComment, deleteCommentAction } = await import("./comments");

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
  const trip = await createTrip(
    t.db,
    {
      name: "台湾旅行",
      currencies: [{ code: "TWD", rateToJpy: 4.7 }],
      areas: [],
    },
    user.id,
  );
  await createEntry(
    t.db,
    trip.id,
    { kind: "food", title: "小籠包", happenedAt: "2026-03-01T12:30" },
    user.id,
  );
  // 別の記録（返信先の取り違えを検出するため）
  await createEntry(
    t.db,
    trip.id,
    { kind: "food", title: "牛肉麺", happenedAt: "2026-03-02T12:30" },
    user.id,
  );
  revalidated.length = 0;
});

describe("addComment", () => {
  it("コメントを投稿して投稿者を残す", async () => {
    const state = await addComment(
      {},
      formData({ entryId: 1, body: "美味しそう" }),
    );
    expect(state).toEqual({ success: "コメントを投稿しました" });

    const [comment] = await listComments(t.db, 1);
    expect(comment).toMatchObject({
      body: "美味しそう",
      authorId: 1,
      parentId: null,
    });
    expect(comment.author.name).toBe("Tester");
    expect(revalidated).toEqual(
      expect.arrayContaining(["/trips/1", "/trips/1/entries/1"]),
    );
  });

  it("返信はスレッドにぶら下がる", async () => {
    await addComment({}, formData({ entryId: 1, body: "親" }));
    await addComment({}, formData({ entryId: 1, parentId: 1, body: "返信" }));

    const threads = buildThreads(await listComments(t.db, 1));
    expect(threads).toHaveLength(1);
    expect(threads[0].replies.map((r) => r.body)).toEqual(["返信"]);
  });

  it("別の記録のコメントを親に指定してもトップレベルとして扱う", async () => {
    await addComment({}, formData({ entryId: 2, body: "別の記録のコメント" }));
    await addComment(
      {},
      formData({ entryId: 1, parentId: 1, body: "迷子の返信" }),
    );

    const [comment] = await listComments(t.db, 1);
    expect(comment.parentId).toBeNull();
  });

  it.each([
    ["本文が空", { body: "   " }, /コメントを入力/],
    ["本文が長すぎる", { body: "あ".repeat(2001) }, /長すぎます/],
  ])("%s なら投稿しない", async (_name, override, pattern) => {
    const state = await addComment({}, formData({ entryId: 1, ...override }));
    expect(state.error).toMatch(pattern);
    expect(await listComments(t.db, 1)).toHaveLength(0);
  });

  it("存在しない記録にはコメントできない", async () => {
    const state = await addComment(
      {},
      formData({ entryId: 999, body: "やあ" }),
    );
    expect(state.error).toMatch(/記録が見つかりません/);
  });
});

describe("deleteCommentAction", () => {
  it("自分のコメントは返信ごと消せる", async () => {
    await addComment({}, formData({ entryId: 1, body: "親" }));
    await addComment({}, formData({ entryId: 1, parentId: 1, body: "返信" }));

    await deleteCommentAction(formData({ id: 1 }));
    expect(await listComments(t.db, 1)).toHaveLength(0);
  });

  it("他の人のコメントは消せない", async () => {
    const other = await upsertUser(t.db, {
      email: "other@example.com",
      name: "Other",
      image: null,
    });
    const { createComment } = await import("@/db/queries");
    await createComment(t.db, { entryId: 1, body: "他人のコメント" }, other.id);

    await expect(deleteCommentAction(formData({ id: 1 }))).rejects.toThrow(
      /他の人のコメント/,
    );
    expect(await listComments(t.db, 1)).toHaveLength(1);
  });

  it("存在しないコメント ID は無視する", async () => {
    await expect(
      deleteCommentAction(formData({ id: 999 })),
    ).resolves.toBeUndefined();
  });
});
