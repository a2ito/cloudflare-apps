import { describe, expect, it } from "vitest";
import {
  dayOf,
  formatDay,
  formatTime,
  isWallClock,
  nowWallClock,
  toWallClock,
} from "./datetime";

describe("isWallClock", () => {
  it("datetime-local の値で、実在する日時だけ通す", () => {
    expect(isWallClock("2026-09-25T12:30")).toBe(true);
    expect(isWallClock("2028-02-29T00:00")).toBe(true);
  });
  it("存在しない日時や形の違うものは弾く", () => {
    expect(isWallClock("2026-02-30T12:00")).toBe(false);
    expect(isWallClock("2026-09-25T24:00")).toBe(false);
    expect(isWallClock("2026-09-25T12:60")).toBe(false);
    expect(isWallClock("2026-09-25")).toBe(false);
    expect(isWallClock("")).toBe(false);
  });
});

describe("toWallClock", () => {
  it("秒以下を落とす", () => {
    expect(toWallClock("2026-09-25T12:30:45")).toBe("2026-09-25T12:30");
  });
  it("不正な値は null", () => {
    expect(toWallClock("yesterday")).toBeNull();
  });
});

describe("nowWallClock", () => {
  it("UTC ではなく日本時間で返す", () => {
    // UTC では 9/24 の 15:30、日本時間では 9/25 の 0:30
    expect(nowWallClock(new Date("2026-09-24T15:30:00Z"))).toBe(
      "2026-09-25T00:30",
    );
  });
  it("正午過ぎも 24 時間表記", () => {
    expect(nowWallClock(new Date("2026-09-25T05:05:00Z"))).toBe(
      "2026-09-25T14:05",
    );
  });
});

describe("表示", () => {
  it("日付に曜日を添える", () => {
    expect(formatDay("2026-09-25T12:30")).toBe("2026/9/25（金）");
  });
  it("時刻と日付を取り出す", () => {
    expect(formatTime("2026-09-25T08:05")).toBe("08:05");
    expect(dayOf("2026-09-25T08:05")).toBe("2026-09-25");
  });
});
