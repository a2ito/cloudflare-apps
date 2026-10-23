import { describe, expect, it } from "vitest";
import {
  formatDateRange,
  formatTimestamp,
  formatWallClock,
  formatWallClockDate,
  isWallClock,
  nowWallClock,
  toWallClock,
} from "./datetime";

describe("isWallClock", () => {
  it("datetime-local の形式を受け付ける", () => {
    expect(isWallClock("2026-03-01T12:30")).toBe(true);
  });
  it("形式違いを弾く", () => {
    expect(isWallClock("2026-03-01")).toBe(false);
    expect(isWallClock("2026-03-01T12:30:00Z")).toBe(false);
    expect(isWallClock("")).toBe(false);
  });
  it("存在しない日時を弾く", () => {
    expect(isWallClock("2026-02-30T12:30")).toBe(false);
    expect(isWallClock("2026-13-01T12:30")).toBe(false);
    expect(isWallClock("2026-03-01T25:00")).toBe(false);
  });
  it("うるう年は通す", () => {
    expect(isWallClock("2028-02-29T00:00")).toBe(true);
    expect(isWallClock("2026-02-29T00:00")).toBe(false);
  });
});

describe("toWallClock", () => {
  it("秒つきは丸めて受け付ける", () => {
    expect(toWallClock("2026-03-01T12:30:45")).toBe("2026-03-01T12:30");
  });
  it("不正な値は null", () => {
    expect(toWallClock("あした")).toBeNull();
  });
});

describe("formatWallClock", () => {
  it("月日と時刻にする", () => {
    expect(formatWallClock("2026-03-01T12:30")).toBe("3/1 12:30");
    expect(formatWallClockDate("2026-03-01T12:30")).toBe("2026/3/1");
  });
  it("タイムゾーン変換をしない（現地時刻のまま）", () => {
    expect(formatWallClock("2026-03-01T00:30")).toBe("3/1 00:30");
  });
});

describe("formatTimestamp", () => {
  it("UTC を日本時間で表示する", () => {
    expect(formatTimestamp("2026-03-01T12:30:00.000Z")).toBe(
      "2026/03/01 21:30",
    );
  });
  it("壊れた値はそのまま返す", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });
});

describe("formatDateRange", () => {
  it("開始と終了を並べる", () => {
    expect(formatDateRange("2026-03-01", "2026-03-05")).toBe(
      "2026/3/1 〜 2026/3/5",
    );
  });
  it("同じ日なら 1 つだけ", () => {
    expect(formatDateRange("2026-03-01", "2026-03-01")).toBe("2026/3/1");
  });
  it("片方だけでも表示する", () => {
    expect(formatDateRange("2026-03-01", null)).toBe("2026/3/1 〜");
    expect(formatDateRange(null, "2026-03-05")).toBe("〜 2026/3/5");
  });
  it("未設定を明示する", () => {
    expect(formatDateRange(null, null)).toBe("日付未設定");
  });
});

describe("nowWallClock", () => {
  it("日本時間の壁時計を返す", () => {
    expect(nowWallClock(new Date("2026-03-01T12:30:00.000Z"))).toBe(
      "2026-03-01T21:30",
    );
  });
  it("結果は datetime-local として妥当", () => {
    expect(isWallClock(nowWallClock())).toBe(true);
  });
});
