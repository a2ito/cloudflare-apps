import { describe, expect, it } from "vitest";
import { formData } from "@/test/d1";
import {
  isWeight,
  parseWorkoutSets,
  repsField,
  weightField,
} from "./workout-form";

const planned = [
  { id: 1, name: "ベンチプレス", targetSets: 2 },
  { id: 2, name: "懸垂", targetSets: 1 },
];

describe("parseWorkoutSets", () => {
  it("種目ごとにセットを読む。回数が空のセットと種目は飛ばす", () => {
    const fd = formData({
      [weightField(1, 1)]: "60",
      [repsField(1, 1)]: "10",
      [weightField(1, 2)]: "60",
      [repsField(1, 2)]: "",
      [weightField(2, 1)]: "",
      [repsField(2, 1)]: "",
    });
    expect(parseWorkoutSets(fd, planned)).toEqual({
      ok: true,
      entries: [
        { exerciseId: 1, sets: [{ setNumber: 1, weight: 60, reps: 10 }] },
      ],
    });
  });

  it("重量が空なら 0kg（自重）として読む", () => {
    const fd = formData({ [repsField(2, 1)]: "8" });
    expect(parseWorkoutSets(fd, planned)).toEqual({
      ok: true,
      entries: [
        { exerciseId: 2, sets: [{ setNumber: 1, weight: 0, reps: 8 }] },
      ],
    });
  });

  it("予定に無い種目・セット番号の欄は読まない", () => {
    const fd = formData({
      [repsField(1, 1)]: "10",
      [repsField(1, 3)]: "10",
      [repsField(9, 1)]: "10",
    });
    const result = parseWorkoutSets(fd, planned);
    expect(result.ok && result.entries).toEqual([
      { exerciseId: 1, sets: [{ setNumber: 1, weight: 0, reps: 10 }] },
    ]);
  });

  it("1 セットも無ければエラー", () => {
    expect(parseWorkoutSets(formData({}), planned)).toEqual({
      ok: false,
      error: "1 セット以上入力してください",
    });
  });

  it.each([
    [
      { [repsField(1, 1)]: "1.5" },
      "ベンチプレス の 1 セット目: 回数は 0〜100 の整数で入力してください",
    ],
    [
      { [repsField(1, 1)]: "101" },
      "ベンチプレス の 1 セット目: 回数は 0〜100 の整数で入力してください",
    ],
    [
      { [repsField(1, 2)]: "10", [weightField(1, 2)]: "abc" },
      "ベンチプレス の 2 セット目: 重量は 0〜500kg を 0.25kg 刻みで入力してください",
    ],
    [
      { [repsField(2, 1)]: "5", [weightField(2, 1)]: "-5" },
      "懸垂 の 1 セット目: 重量は 0〜500kg を 0.25kg 刻みで入力してください",
    ],
  ])("不正な値 %o はエラー", (fields, error) => {
    expect(parseWorkoutSets(formData(fields), planned)).toEqual({
      ok: false,
      error,
    });
  });
});

describe("isWeight", () => {
  it("0〜500kg の 0.25kg 刻みだけ通す", () => {
    expect([0, 1.25, 62.5, 500].every(isWeight)).toBe(true);
    expect([-0.25, 500.25, 60.1, Number.NaN].some(isWeight)).toBe(false);
  });
});
