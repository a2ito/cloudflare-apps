import { describe, expect, it } from "vitest";
import { buildThreads, countComments } from "./comments";

const c = (id: number, parentId: number | null, createdAt: string) => ({
  id,
  parentId,
  createdAt,
});

describe("buildThreads", () => {
  it("トップレベルと返信を分ける", () => {
    const threads = buildThreads([
      c(1, null, "2026-01-01T00:00:00Z"),
      c(2, 1, "2026-01-01T01:00:00Z"),
      c(3, null, "2026-01-01T02:00:00Z"),
    ]);
    expect(threads.map((t) => t.comment.id)).toEqual([1, 3]);
    expect(threads[0].replies.map((r) => r.id)).toEqual([2]);
    expect(threads[1].replies).toEqual([]);
  });

  it("孫以降はトップレベルのスレッドに畳む", () => {
    const threads = buildThreads([
      c(1, null, "2026-01-01T00:00:00Z"),
      c(2, 1, "2026-01-01T01:00:00Z"),
      c(3, 2, "2026-01-01T02:00:00Z"),
    ]);
    expect(threads).toHaveLength(1);
    expect(threads[0].replies.map((r) => r.id)).toEqual([2, 3]);
  });

  it("投稿時刻の昇順で並ぶ", () => {
    const threads = buildThreads([
      c(3, null, "2026-01-03T00:00:00Z"),
      c(1, null, "2026-01-01T00:00:00Z"),
      c(2, 1, "2026-01-05T00:00:00Z"),
      c(4, 1, "2026-01-02T00:00:00Z"),
    ]);
    expect(threads.map((t) => t.comment.id)).toEqual([1, 3]);
    expect(threads[0].replies.map((r) => r.id)).toEqual([4, 2]);
  });

  it("親が存在しない返信はトップレベルとして扱う", () => {
    const threads = buildThreads([c(2, 99, "2026-01-01T00:00:00Z")]);
    expect(threads.map((t) => t.comment.id)).toEqual([2]);
  });

  it("親子が循環していても無限ループしない", () => {
    const threads = buildThreads([
      c(1, 2, "2026-01-01T00:00:00Z"),
      c(2, 1, "2026-01-01T01:00:00Z"),
    ]);
    expect(threads.length).toBeGreaterThan(0);
    expect(countComments(threads)).toBe(2);
  });

  it("空配列なら空", () => {
    expect(buildThreads([])).toEqual([]);
  });
});

describe("countComments", () => {
  it("返信を含めて数える", () => {
    const threads = buildThreads([
      c(1, null, "2026-01-01T00:00:00Z"),
      c(2, 1, "2026-01-01T01:00:00Z"),
      c(3, null, "2026-01-01T02:00:00Z"),
    ]);
    expect(countComments(threads)).toBe(3);
  });
});
