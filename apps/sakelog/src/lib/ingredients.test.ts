import { describe, expect, it } from "vitest";
import {
  formatIngredients,
  MAX_INGREDIENTS,
  parseIngredients,
} from "./ingredients";

describe("parseIngredients", () => {
  it("カンマ区切りを書いた順に分解する", () => {
    expect(parseIngredients("カベルネ・ソーヴィニヨン, メルロー")).toEqual([
      "カベルネ・ソーヴィニヨン",
      "メルロー",
    ]);
  });

  it("日本語の読点でも区切れる", () => {
    expect(parseIngredients("甲州、マスカット・ベーリーA")).toEqual([
      "甲州",
      "マスカット・ベーリーA",
    ]);
  });

  it("同じ材料は 1 つにまとめる（DB の一意制約に当てない）", () => {
    expect(parseIngredients("メルロー, メルロー")).toEqual(["メルロー"]);
  });

  it("空の要素は落とす", () => {
    expect(parseIngredients(" , メルロー , ")).toEqual(["メルロー"]);
    expect(parseIngredients("")).toEqual([]);
    expect(parseIngredients(undefined)).toEqual([]);
  });

  it("上限を超えた分は切る", () => {
    const many = Array.from(
      { length: MAX_INGREDIENTS + 5 },
      (_, i) => `材料${i}`,
    ).join(",");
    expect(parseIngredients(many)).toHaveLength(MAX_INGREDIENTS);
  });

  it("長すぎる名前は落とす（貼り付け事故の取り込みを防ぐ）", () => {
    expect(parseIngredients(`メルロー, ${"あ".repeat(51)}`)).toEqual([
      "メルロー",
    ]);
  });
});

describe("formatIngredients", () => {
  it("入力欄に戻せる形にする", () => {
    expect(formatIngredients(["メルロー", "シラー"])).toBe("メルロー, シラー");
    expect(parseIngredients(formatIngredients(["メルロー", "シラー"]))).toEqual(
      ["メルロー", "シラー"],
    );
  });
});
