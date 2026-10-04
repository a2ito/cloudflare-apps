import { describe, expect, it } from "vitest";
import {
  MAX_RECENT_GROUPS,
  forgetGroup,
  parseRecentGroups,
  rememberGroup,
  type RecentGroup,
} from "./recent-groups";

const g = (id: string, visitedAt = 0, name = `group ${id}`): RecentGroup => ({
  id,
  name,
  visitedAt,
});

describe("parseRecentGroups", () => {
  it("保存した一覧を読める", () => {
    const list = [g("a", 2), g("b", 1)];
    expect(parseRecentGroups(JSON.stringify(list))).toEqual(list);
  });

  it("未保存・壊れた JSON・配列でないものは空", () => {
    expect(parseRecentGroups(null)).toEqual([]);
    expect(parseRecentGroups("{")).toEqual([]);
    expect(parseRecentGroups('{"id":"a"}')).toEqual([]);
  });

  it("形の合わない要素だけを捨てる", () => {
    const raw = JSON.stringify([g("a"), { id: "b" }, null, { id: "", name: "x", visitedAt: 0 }]);
    expect(parseRecentGroups(raw)).toEqual([g("a")]);
  });
});

describe("rememberGroup", () => {
  it("開いたグループを先頭に足す", () => {
    expect(rememberGroup([g("a", 1)], g("b", 2))).toEqual([g("b", 2), g("a", 1)]);
  });

  it("同じグループは 1 つにまとめ、名前と日時を新しくする", () => {
    const list = [g("a", 2), g("b", 1, "旧名")];
    expect(rememberGroup(list, g("b", 3, "新名"))).toEqual([g("b", 3, "新名"), g("a", 2)]);
  });

  it(`${MAX_RECENT_GROUPS} 件を超えたら古いものから落とす`, () => {
    const list = Array.from({ length: MAX_RECENT_GROUPS }, (_, i) => g(`old${i}`));
    const next = rememberGroup(list, g("new"));
    expect(next).toHaveLength(MAX_RECENT_GROUPS);
    expect(next[0].id).toBe("new");
    expect(next.some((x) => x.id === `old${MAX_RECENT_GROUPS - 1}`)).toBe(false);
  });

  it("元の一覧を書き換えない", () => {
    const list = [g("a")];
    rememberGroup(list, g("b"));
    expect(list).toEqual([g("a")]);
  });
});

describe("forgetGroup", () => {
  it("指定したグループだけを外す", () => {
    expect(forgetGroup([g("a"), g("b")], "a")).toEqual([g("b")]);
  });
});
