import { describe, expect, it } from "vitest";
import {
  averageRating,
  RATING_AXES,
  ratingFieldName,
  representativeRating,
  toRatings,
  toRatingValue,
  type Ratings,
} from "./ratings";

const empty: Ratings = {
  overall: null,
  aroma: null,
  taste: null,
  finish: null,
  value: null,
};

describe("toRatingValue", () => {
  it("0（未評価）と範囲外は null にする", () => {
    expect(toRatingValue(0)).toBeNull();
    expect(toRatingValue(6)).toBeNull();
    expect(toRatingValue(-1)).toBeNull();
  });
  it("1〜5 はそのまま", () => {
    expect(toRatingValue(1)).toBe(1);
    expect(toRatingValue(5)).toBe(5);
  });
});

describe("averageRating", () => {
  it("付いている軸だけで平均する", () => {
    expect(averageRating({ ...empty, aroma: 4, taste: 5 })).toBe(4.5);
  });
  it("1 つも付いていなければ null", () => {
    expect(averageRating(empty)).toBeNull();
  });
});

describe("representativeRating", () => {
  it("総合が付いていればそれを使う", () => {
    expect(
      representativeRating({ ...empty, overall: 3, aroma: 5, taste: 5 }),
    ).toBe(3);
  });
  it("総合が無ければ他の軸の平均を四捨五入する", () => {
    expect(representativeRating({ ...empty, aroma: 4, taste: 5 })).toBe(5);
    expect(representativeRating({ ...empty, aroma: 4, taste: 3 })).toBe(4);
  });
  it("何も付いていなければ null", () => {
    expect(representativeRating(empty)).toBeNull();
  });
});

describe("ratingFieldName", () => {
  it("軸の key から DB の列名と同じ名前を作る", () => {
    expect(ratingFieldName("overall")).toBe("ratingOverall");
    expect(ratingFieldName("value")).toBe("ratingValue");
  });

  it("すべての軸が DB の行から読み出せる（軸を足したときの取りこぼしを防ぐ）", () => {
    const row = {
      ratingOverall: 5,
      ratingAroma: 4,
      ratingTaste: 3,
      ratingFinish: 2,
      ratingValue: 1,
    };
    const ratings = toRatings(row);
    for (const axis of RATING_AXES) {
      expect(ratings[axis.key], `${axis.key} が読めていません`).toBe(
        row[ratingFieldName(axis.key)],
      );
    }
  });
});
