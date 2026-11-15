import { describe, expect, it } from "vitest";
import { isOnline } from "./status";
import { formatAgo, formatDateTime } from "./time";

const now = new Date("2026-11-15T03:00:00.000Z");

describe("isOnline", () => {
  it("最後の受信から 5 分以内ならオンライン", () => {
    expect(isOnline("2026-11-15T02:55:00.000Z", now)).toBe(true);
  });

  it("5 分を超えたらオフライン", () => {
    expect(isOnline("2026-11-15T02:54:59.999Z", now)).toBe(false);
  });

  it("一度も受信していなければオフライン", () => {
    expect(isOnline(null, now)).toBe(false);
  });
});

describe("formatAgo", () => {
  it.each([
    ["2026-11-15T02:59:30.000Z", "たった今"],
    ["2026-11-15T03:00:30.000Z", "たった今"],
    ["2026-11-15T02:57:00.000Z", "3 分前"],
    ["2026-11-15T01:00:00.000Z", "2 時間前"],
    ["2026-11-13T03:00:00.000Z", "2 日前"],
  ])("%s → %s", (iso, expected) => {
    expect(formatAgo(new Date(iso), now)).toBe(expected);
  });
});

describe("formatDateTime", () => {
  it("日本時間で表示する（UTC のままだと 9 時間ずれる）", () => {
    expect(formatDateTime(new Date("2026-11-14T15:30:00.000Z"))).toBe(
      "11/15 00:30",
    );
  });
});
