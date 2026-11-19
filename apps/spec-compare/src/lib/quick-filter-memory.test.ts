import { describe, expect, it } from "vitest";
import {
  hasQuickKeys,
  parseQuickFiltersOpen,
  parseSavedQuickParams,
  pickQuickParams,
  withQuickParams,
} from "./quick-filter-memory";

describe("pickQuickParams", () => {
  it("簡易フィルタの項目の条件だけを、複数選択も含めて抜き出す", () => {
    const search = new URLSearchParams(
      "sort=f2&in_16=Windows&in_16=macOS&min_2=32&max_9=1&q_16=win&fav=1&in_4=&maker=ASUS",
    );
    expect(pickQuickParams(search, [16, 2])).toEqual([
      ["in_16", "Windows"],
      ["in_16", "macOS"],
      ["min_2", "32"],
      ["maker", "ASUS"],
    ]);
  });

  it("真偽値の項目は、外した印の 0 を除いて付けた 1 だけを残す", () => {
    const search = new URLSearchParams("has_5=0&has_6=0&has_6=1");
    expect(pickQuickParams(search, [5, 6])).toEqual([["has_6", "1"]]);
  });
});

describe("hasQuickKeys", () => {
  it("空の値で外した条件も、指定したとみなす", () => {
    expect(hasQuickKeys(new URLSearchParams("sort=f2&max_4="), [4])).toBe(true);
    expect(hasQuickKeys(new URLSearchParams("maker="), [4])).toBe(true);
    expect(hasQuickKeys(new URLSearchParams("has_5=0"), [5])).toBe(true);
  });

  it("簡易フィルタの項目でない条件だけなら、指定していないとみなす", () => {
    expect(hasQuickKeys(new URLSearchParams("sort=f2&max_9=1"), [4])).toBe(
      false,
    );
    expect(hasQuickKeys(new URLSearchParams(""), [4])).toBe(false);
  });
});

describe("parseSavedQuickParams", () => {
  it("壊れた値や形の違う値は空にする", () => {
    expect(parseSavedQuickParams(null)).toEqual([]);
    expect(parseSavedQuickParams("{")).toEqual([]);
    expect(parseSavedQuickParams('{"a":1}')).toEqual([]);
    expect(parseSavedQuickParams('[["in_1","a"],["x"],[1,2]]')).toEqual([
      ["in_1", "a"],
    ]);
  });
});

describe("withQuickParams", () => {
  it("今の条件を残して足す", () => {
    expect(
      withQuickParams(new URLSearchParams("sort=name"), [
        ["in_1", "a"],
        ["in_1", "b"],
      ]),
    ).toBe("sort=name&in_1=a&in_1=b");
  });
});

describe("parseQuickFiltersOpen", () => {
  it("畳んだと保存されているときだけ閉じる", () => {
    expect(parseQuickFiltersOpen("0")).toBe(false);
    expect(parseQuickFiltersOpen("1")).toBe(true);
  });

  it("保存が無い・壊れているときは開いておく", () => {
    expect(parseQuickFiltersOpen(null)).toBe(true);
    expect(parseQuickFiltersOpen("x")).toBe(true);
  });
});
