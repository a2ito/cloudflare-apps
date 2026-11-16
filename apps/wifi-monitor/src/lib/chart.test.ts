import { describe, expect, it } from "vitest";
import { toSegments, valueDomain } from "./chart";

describe("toSegments", () => {
  it("間が maxGap を超えたところで線を切る（計測が途切れたことが分かるように）", () => {
    const segments = toSegments(
      [
        { t: 0, v: 1 },
        { t: 60, v: 2 },
        { t: 600, v: 3 },
        { t: 660, v: 4 },
      ],
      120,
    );
    expect(segments).toEqual([
      [
        { t: 0, v: 1 },
        { t: 60, v: 2 },
      ],
      [
        { t: 600, v: 3 },
        { t: 660, v: 4 },
      ],
    ]);
  });

  it("値の無い点でも線を切る", () => {
    expect(
      toSegments(
        [
          { t: 0, v: 1 },
          { t: 60, v: null },
          { t: 120, v: 3 },
        ],
        1000,
      ),
    ).toEqual([[{ t: 0, v: 1 }], [{ t: 120, v: 3 }]]);
  });

  it("点が無ければ空", () => {
    expect(toSegments([], 60)).toEqual([]);
  });
});

describe("valueDomain", () => {
  it("上下に 1 割の余白をつける", () => {
    expect(valueDomain([10, 20])).toEqual([9, 21]);
  });

  it("全部同じ値でも幅が 0 にならない", () => {
    expect(valueDomain([-50, -50])).toEqual([-51, -49]);
  });

  it("includeZero で全部 0 なら、負の側に幅を取らない", () => {
    expect(valueDomain([0, 0], { includeZero: true })).toEqual([0, 1]);
  });

  it("includeZero なら 0 から始める", () => {
    expect(valueDomain([10, 20], { includeZero: true })).toEqual([0, 22]);
  });

  it("値が無ければ null", () => {
    expect(valueDomain([])).toBeNull();
  });
});
