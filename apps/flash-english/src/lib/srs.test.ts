import { describe, expect, it } from "vitest";
import { pickQuestions, review } from "./srs";

const fresh = { streak: 0, correctCount: 0, wrongCount: 0 };

describe("review", () => {
  it("1 回目の○で翌日に出す", () => {
    expect(review(fresh, true, "2026-10-12")).toEqual({
      streak: 1,
      correctCount: 1,
      wrongCount: 0,
      dueOn: "2026-10-13",
      lastReviewedOn: "2026-10-12",
    });
  });

  it.each([
    [1, "2026-10-15"],
    [2, "2026-10-19"],
    [3, "2026-10-26"],
    [4, "2026-11-11"],
    [5, "2026-12-11"],
    [6, "2026-12-11"], // 60 日より先には伸ばさない
    [20, "2026-12-11"],
  ])("連続○ %i 回のあとの○は間隔を伸ばす（%s）", (streak, dueOn) => {
    expect(review({ ...fresh, streak }, true, "2026-10-12").dueOn).toBe(dueOn);
  });

  it("×で連続○を 0 に戻し、今日また出す", () => {
    expect(
      review(
        { streak: 4, correctCount: 4, wrongCount: 1 },
        false,
        "2026-10-12",
      ),
    ).toEqual({
      streak: 0,
      correctCount: 4,
      wrongCount: 2,
      dueOn: "2026-10-12",
      lastReviewedOn: "2026-10-12",
    });
  });
});

describe("pickQuestions", () => {
  const today = "2026-10-12";

  it("期限を過ぎた文を先に、×の多い順・期限の古い順に並べる", () => {
    const picked = pickQuestions(
      [
        { id: 1, dueOn: "2026-10-12", wrongCount: 0 },
        { id: 2, dueOn: "2026-10-01", wrongCount: 0 },
        { id: 3, dueOn: "2026-10-12", wrongCount: 3 },
        { id: 4, dueOn: "2026-10-20", wrongCount: 9 },
      ],
      today,
    );
    expect(picked.map((c) => c.id)).toEqual([3, 2, 1, 4]);
  });

  it("期限の文で足りなければ、期限の近い文で埋める", () => {
    const picked = pickQuestions(
      [
        { id: 1, dueOn: "2026-11-01", wrongCount: 0 },
        { id: 2, dueOn: "2026-10-13", wrongCount: 0 },
        { id: 3, dueOn: "2026-10-12", wrongCount: 0 },
      ],
      today,
      2,
    );
    expect(picked.map((c) => c.id)).toEqual([3, 2]);
  });

  it("上限を超えて出さない", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      dueOn: today,
      wrongCount: 0,
    }));
    expect(pickQuestions(many, today)).toHaveLength(10);
  });
});
