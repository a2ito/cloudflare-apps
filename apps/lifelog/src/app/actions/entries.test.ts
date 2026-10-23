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
  addPhotos,
  createEntry,
  getEntry,
  listEntries,
  upsertUser,
} from "@/db/queries";
import { MAX_PHOTOS_PER_ENTRY } from "@/lib/photo-limits";
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
const { deleteEntryAction, deletePhotoAction, saveEntry } =
  await import("./entries");

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

async function bucketKeys(): Promise<string[]> {
  return (await t.bucket.list()).objects.map((o) => o.key);
}

async function allEntries(userId = 1) {
  return (await listEntries(t.db, userId, { limit: 100 })).entries;
}

const valid = { happenedAt: "2026-09-25T12:30", body: "公園を散歩した" };

describe("saveEntry", () => {
  it("日記を保存して詳細ページへ遷移する", async () => {
    const to = await expectRedirect(() => saveEntry({}, formData(valid)));
    const [entry] = await allEntries();
    expect(entry).toMatchObject({
      userId: 1,
      happenedAt: "2026-09-25T12:30",
      body: "公園を散歩した",
    });
    expect(to).toBe(`/entries/${entry.id}`);
    expect(revalidated).toContain("/");
  });

  it("ブラウザが秒まで送ってきても分単位で保存する", async () => {
    await expectRedirect(() =>
      saveEntry({}, formData({ ...valid, happenedAt: "2026-09-25T12:30:15" })),
    );
    expect((await allEntries())[0].happenedAt).toBe("2026-09-25T12:30");
  });

  it("写真を R2 に置き、キーを日記に紐づける", async () => {
    const fd = formData(valid);
    fd.append("photos", fakeImage("image/jpeg"));
    fd.append("photos", fakeImage("image/png", 2048, "b.png"));
    await expectRedirect(() => saveEntry({}, fd));

    const [entry] = await allEntries();
    expect(entry.photos.map((p) => p.contentType)).toEqual([
      "image/jpeg",
      "image/png",
    ]);
    expect((await bucketKeys()).sort()).toEqual(
      entry.photos.map((p) => p.key).sort(),
    );
    expect(entry.photos[0].key).toMatch(
      new RegExp(`^entries/${entry.id}/[0-9a-f-]{36}\\.jpg$`),
    );
  });

  it("写真だけの日記も書ける", async () => {
    const fd = formData({ ...valid, body: "" });
    fd.append("photos", fakeImage());
    await expectRedirect(() => saveEntry({}, fd));
    expect(await allEntries()).toHaveLength(1);
  });

  it("何も選ばずに送られた空の file input は写真として扱わない", async () => {
    const fd = formData(valid);
    fd.append("photos", new File([], "", { type: "application/octet-stream" }));
    await expectRedirect(() => saveEntry({}, fd));
    expect((await allEntries())[0].photos).toHaveLength(0);
  });

  it.each([
    [{ body: "   " }, "本文か写真のどちらかを入れてください"],
    [{ happenedAt: "2026-02-30T12:00" }, "日時の形式が不正です"],
    [{ happenedAt: "" }, "日時の形式が不正です"],
    [{ body: "あ".repeat(10_001) }, "本文は 10,000 文字までです"],
  ])("不正な入力 %o は保存しない", async (override, error) => {
    expect(await saveEntry({}, formData({ ...valid, ...override }))).toEqual({
      error,
    });
    expect(await allEntries()).toHaveLength(0);
  });

  it("写真が駄目なら本文も保存しない（送り直しで 2 件にならないように）", async () => {
    const fd = formData(valid);
    fd.append("photos", fakeImage("application/pdf", 1024, "a.pdf"));
    expect(await saveEntry({}, fd)).toEqual({
      error: "対応していない画像形式です: application/pdf",
    });
    expect(await allEntries()).toHaveLength(0);
    expect(await bucketKeys()).toHaveLength(0);
  });

  it("既存の日記を書き換え、写真は足していく", async () => {
    const entry = await createEntry(t.db, 1, valid);
    await addPhotos(t.db, entry.id, [
      { key: `entries/${entry.id}/old.jpg`, contentType: "image/jpeg" },
    ]);

    const fd = formData({
      id: entry.id,
      happenedAt: "2026-09-25T20:00",
      body: "夜に追記",
    });
    fd.append("photos", fakeImage());
    await expectRedirect(() => saveEntry({}, fd));

    const updated = await getEntry(t.db, 1, entry.id);
    expect(updated).toMatchObject({
      happenedAt: "2026-09-25T20:00",
      body: "夜に追記",
    });
    expect(updated?.photos).toHaveLength(2);
    expect(updated?.updatedAt).not.toBe(entry.updatedAt);
  });

  it("すでに付いている写真と合わせて上限を超えるなら断る", async () => {
    const entry = await createEntry(t.db, 1, valid);
    await addPhotos(
      t.db,
      entry.id,
      Array.from({ length: MAX_PHOTOS_PER_ENTRY }, (_, i) => ({
        key: `entries/${entry.id}/${i}.jpg`,
        contentType: "image/jpeg",
      })),
    );
    const fd = formData({ ...valid, id: entry.id });
    fd.append("photos", fakeImage());
    expect(await saveEntry({}, fd)).toHaveProperty("error");
    expect((await getEntry(t.db, 1, entry.id))?.photos).toHaveLength(
      MAX_PHOTOS_PER_ENTRY,
    );
  });

  it("他人の日記は書き換えない", async () => {
    const other = await upsertUser(t.db, {
      email: "other@example.com",
      name: null,
      image: null,
    });
    const entry = await createEntry(t.db, other.id, valid);
    expect(
      await saveEntry(
        {},
        formData({ ...valid, id: entry.id, body: "乗っ取り" }),
      ),
    ).toEqual({
      error: "日記が見つかりません",
    });
    expect((await getEntry(t.db, other.id, entry.id))?.body).toBe(valid.body);
  });
});

describe("deleteEntryAction", () => {
  it("日記と、R2 に置いた写真の実体を消す", async () => {
    const fd = formData(valid);
    fd.append("photos", fakeImage());
    await expectRedirect(() => saveEntry({}, fd));
    const [entry] = await allEntries();

    const to = await expectRedirect(() =>
      deleteEntryAction(formData({ id: entry.id })),
    );
    expect(to).toBe("/");
    expect(await allEntries()).toHaveLength(0);
    expect(await bucketKeys()).toHaveLength(0);
  });

  it("他人の日記は消さない", async () => {
    const other = await upsertUser(t.db, {
      email: "other@example.com",
      name: null,
      image: null,
    });
    const entry = await createEntry(t.db, other.id, valid);
    await expectRedirect(() => deleteEntryAction(formData({ id: entry.id })));
    expect(await getEntry(t.db, other.id, entry.id)).not.toBeNull();
  });
});

describe("deletePhotoAction", () => {
  it("写真を 1 枚だけ消す", async () => {
    const fd = formData(valid);
    fd.append("photos", fakeImage());
    fd.append("photos", fakeImage());
    await expectRedirect(() => saveEntry({}, fd));
    const [entry] = await allEntries();
    const [first, second] = entry.photos;

    await deletePhotoAction(formData({ id: first.id }));
    expect(
      (await getEntry(t.db, 1, entry.id))?.photos.map((p) => p.id),
    ).toEqual([second.id]);
    expect(await bucketKeys()).toEqual([second.key]);
  });

  it("他人の写真は消さない", async () => {
    const other = await upsertUser(t.db, {
      email: "other@example.com",
      name: null,
      image: null,
    });
    const entry = await createEntry(t.db, other.id, valid);
    const key = `entries/${entry.id}/theirs.jpg`;
    await t.bucket.put(key, new Uint8Array(8));
    await addPhotos(t.db, entry.id, [{ key, contentType: "image/jpeg" }]);
    const [photo] = (await getEntry(t.db, other.id, entry.id))?.photos ?? [];

    await deletePhotoAction(formData({ id: photo.id }));
    expect((await getEntry(t.db, other.id, entry.id))?.photos).toHaveLength(1);
    expect(await bucketKeys()).toEqual([key]);
  });
});
