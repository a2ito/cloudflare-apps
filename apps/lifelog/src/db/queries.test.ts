import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv, type TestEnv } from "@/test/d1";
import {
  addPhotos,
  createEntry,
  decodeCursor,
  encodeCursor,
  getOwnedPhotoByKey,
  listEntries,
  upsertUser,
} from "./queries";

let t: TestEnv;
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
});

describe("listEntries", () => {
  it("持ち主の日記だけを、新しい順に返す", async () => {
    const other = await upsertUser(t.db, {
      email: "other@example.com",
      name: null,
      image: null,
    });
    await createEntry(t.db, 1, {
      happenedAt: "2026-09-24T08:00",
      body: "前日",
    });
    await createEntry(t.db, 1, { happenedAt: "2026-09-25T21:00", body: "夜" });
    await createEntry(t.db, 1, { happenedAt: "2026-09-25T07:00", body: "朝" });
    await createEntry(t.db, other.id, {
      happenedAt: "2026-09-25T12:00",
      body: "他人",
    });

    const { entries, next } = await listEntries(t.db, 1, { limit: 10 });
    expect(entries.map((e) => e.body)).toEqual(["夜", "朝", "前日"]);
    expect(next).toBeNull();
  });

  it("同じ時刻の日記がページの境目にあっても取りこぼさない", async () => {
    for (const body of ["a", "b", "c"])
      await createEntry(t.db, 1, { happenedAt: "2026-09-25T12:00", body });

    const first = await listEntries(t.db, 1, { limit: 2 });
    expect(first.entries.map((e) => e.body)).toEqual(["c", "b"]);
    const second = await listEntries(t.db, 1, {
      before: decodeCursor(first.next ?? undefined),
      limit: 2,
    });
    expect(second.entries.map((e) => e.body)).toEqual(["a"]);
    expect(second.next).toBeNull();
  });

  it("写真を日記ごとにまとめて付ける", async () => {
    const a = await createEntry(t.db, 1, {
      happenedAt: "2026-09-25T08:00",
      body: "a",
    });
    const b = await createEntry(t.db, 1, {
      happenedAt: "2026-09-25T09:00",
      body: "b",
    });
    await addPhotos(t.db, a.id, [
      { key: "entries/a/1.jpg", contentType: "image/jpeg" },
    ]);

    const { entries } = await listEntries(t.db, 1, { limit: 10 });
    expect(entries.find((e) => e.id === a.id)?.photos).toHaveLength(1);
    expect(entries.find((e) => e.id === b.id)?.photos).toEqual([]);
  });
});

describe("cursor", () => {
  it("往復できる", () => {
    expect(
      decodeCursor(encodeCursor({ happenedAt: "2026-09-25T12:00", id: 42 })),
    ).toEqual({ happenedAt: "2026-09-25T12:00", id: 42 });
  });
  it("おかしな値は無視する", () => {
    expect(decodeCursor("x' OR 1=1")).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });
});

describe("getOwnedPhotoByKey", () => {
  it("他人の日記の写真は返さない", async () => {
    const other = await upsertUser(t.db, {
      email: "other@example.com",
      name: null,
      image: null,
    });
    const entry = await createEntry(t.db, other.id, {
      happenedAt: "2026-09-25T08:00",
      body: "x",
    });
    await addPhotos(t.db, entry.id, [
      { key: "entries/x/1.jpg", contentType: "image/jpeg" },
    ]);

    expect(await getOwnedPhotoByKey(t.db, 1, "entries/x/1.jpg")).toBeNull();
    expect(
      await getOwnedPhotoByKey(t.db, other.id, "entries/x/1.jpg"),
    ).not.toBeNull();
  });
});
