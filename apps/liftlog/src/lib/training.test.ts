import { describe, expect, it } from "vitest";
import { formatWeight, nextMenu, nextWeight } from "./training";

describe("nextMenu", () => {
  const menus = [{ id: 1 }, { id: 3 }, { id: 5 }];

  it("記録が無ければ先頭から始める", () => {
    expect(nextMenu(menus, null)).toEqual({ id: 1 });
    expect(nextMenu(menus, undefined)).toEqual({ id: 1 });
  });
  it("前回の次を返し、最後まで行ったら先頭に戻る", () => {
    expect(nextMenu(menus, 1)).toEqual({ id: 3 });
    expect(nextMenu(menus, 3)).toEqual({ id: 5 });
    expect(nextMenu(menus, 5)).toEqual({ id: 1 });
  });
  it("前回のメニューが消されていても、消えた位置の次から続ける", () => {
    expect(nextMenu(menus, 4)).toEqual({ id: 5 });
    expect(nextMenu(menus, 9)).toEqual({ id: 1 });
  });
  it("メニューが無ければ undefined", () => {
    expect(nextMenu([], 1)).toBeUndefined();
  });
});

describe("nextWeight", () => {
  const goal = { weight: 60, targetSets: 3, targetReps: 10, increment: 2.5 };

  it("全セットで目標回数に届いたら上げ幅だけ足す", () => {
    const sets = [
      { weight: 60, reps: 10 },
      { weight: 60, reps: 12 },
      { weight: 60, reps: 10 },
    ];
    expect(nextWeight(goal, sets)).toBe(62.5);
  });
  it("1 セットでも届かなければ据え置く", () => {
    const sets = [
      { weight: 60, reps: 10 },
      { weight: 60, reps: 10 },
      { weight: 60, reps: 8 },
    ];
    expect(nextWeight(goal, sets)).toBe(60);
  });
  it("セット数が足りなければ据え置く", () => {
    expect(
      nextWeight(goal, [
        { weight: 60, reps: 10 },
        { weight: 60, reps: 10 },
      ]),
    ).toBe(60);
  });
  it("予定より軽い重量でこなしたセットは数えない", () => {
    const sets = [
      { weight: 60, reps: 10 },
      { weight: 60, reps: 10 },
      { weight: 55, reps: 10 },
    ];
    expect(nextWeight(goal, sets)).toBe(60);
  });
  it("予定より重くこなしたセットは数える", () => {
    const sets = [
      { weight: 60, reps: 10 },
      { weight: 60, reps: 10 },
      { weight: 65, reps: 10 },
    ];
    expect(nextWeight(goal, sets)).toBe(62.5);
  });
  it("上げ幅 0 なら上げない", () => {
    const sets = [{ weight: 0, reps: 10 }];
    expect(
      nextWeight(
        { weight: 0, targetSets: 1, targetReps: 10, increment: 0 },
        sets,
      ),
    ).toBe(0);
  });
});

describe("formatWeight", () => {
  it("整数は小数点を出さず、端数は余計な 0 を落とす", () => {
    expect(formatWeight(60)).toBe("60kg");
    expect(formatWeight(62.5)).toBe("62.5kg");
    expect(formatWeight(1.25)).toBe("1.25kg");
  });
});
