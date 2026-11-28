import { describe, expect, it } from "vitest";
import {
  checkParentLink,
  checkPartnerLink,
  isDescendant,
  orderPair,
  type ParentLink,
  type PartnerLink,
} from "./relations";

// 1 祖父 ─ 2 祖母
//      │
//      3 父 ─ 4 母
//           │
//           5 子
const links: ParentLink[] = [
  { parentId: 1, childId: 3 },
  { parentId: 2, childId: 3 },
  { parentId: 3, childId: 5 },
  { parentId: 4, childId: 5 },
];
const partners: PartnerLink[] = [
  { personAId: 1, personBId: 2 },
  { personAId: 3, personBId: 4 },
];

describe("isDescendant", () => {
  it("子・孫をたどれる", () => {
    expect(isDescendant(links, 1, 3)).toBe(true);
    expect(isDescendant(links, 1, 5)).toBe(true);
  });
  it("先祖や無関係の人は子孫ではない", () => {
    expect(isDescendant(links, 5, 1)).toBe(false);
    expect(isDescendant(links, 4, 1)).toBe(false);
    expect(isDescendant(links, 1, 1)).toBe(false);
  });
});

describe("checkParentLink", () => {
  it("新しい親子は通す", () => {
    expect(checkParentLink(links, partners, 4, 6)).toEqual({ ok: true });
  });
  it.each([
    [3, 3, "自分自身を親にはできません"],
    [3, 5, "すでに親子としてつながっています"],
    [5, 3, "親と子が逆向きにすでにつながっています"],
    [6, 5, "親は 2 人までです"],
    [5, 1, "子孫を親にはできません"],
    [3, 4, "配偶者どうしを親子にはできません"],
  ])("%i を %i の親にはできない", (parent, child, error) => {
    expect(checkParentLink(links, partners, parent, child)).toEqual({
      ok: false,
      error,
    });
  });
});

describe("checkPartnerLink", () => {
  it("再婚のように、すでに配偶者がいる人とも結べる", () => {
    expect(checkPartnerLink(links, partners, 3, 6)).toEqual({ ok: true });
  });
  it.each([
    [3, 3, "自分自身を配偶者にはできません"],
    [4, 3, "すでに配偶者としてつながっています"],
    [1, 5, "先祖・子孫とは配偶者にできません"],
    [5, 1, "先祖・子孫とは配偶者にできません"],
  ])("%i と %i は結べない", (a, b, error) => {
    expect(checkPartnerLink(links, partners, a, b)).toEqual({
      ok: false,
      error,
    });
  });
});

describe("orderPair", () => {
  it("小さい方を先にする", () => {
    expect(orderPair(5, 2)).toEqual([2, 5]);
    expect(orderPair(2, 5)).toEqual([2, 5]);
  });
});
