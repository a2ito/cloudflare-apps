/**
 * 日時の扱いは 2 種類ある。
 *  - happenedAt: 日本時間の壁時計時刻（"2026-09-25T12:30"）。<input type="datetime-local">
 *    の値をタイムゾーン変換せずにそのまま持つ。文字列の並びがそのまま時系列になる。
 *  - createdAt / updatedAt: 監査用の UTC ISO 文字列。
 */

const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** <input type="datetime-local"> の値として妥当か */
export function isWallClock(value: string): boolean {
  if (!WALL_CLOCK.test(value)) return false;
  const [date, time] = value.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (hh > 23 || mm > 59) return false;
  // 2 月 30 日のような存在しない日付を弾く
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

/** ブラウザによっては秒まで送ってくるので、datetime-local が扱える分単位に丸める */
export function toWallClock(value: string): string | null {
  const trimmed = value.trim().slice(0, 16);
  return isWallClock(trimmed) ? trimmed : null;
}

/** いまの日本時間の壁時計時刻。Workers は UTC で動くため、そのまま Date を使うと 9 時間ずれる */
export function nowWallClock(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** "2026-09-25T12:30" -> "2026/9/25（金）" */
export function formatDay(wallClock: string): string {
  const [y, m, d] = wallClock.slice(0, 10).split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}/${m}/${d}（${weekday}）`;
}

/** "2026-09-25T12:30" -> "12:30" */
export function formatTime(wallClock: string): string {
  return wallClock.slice(11, 16);
}

/** "2026-09-25T12:30" -> "2026-09-25"。一覧を日ごとにまとめるのに使う */
export function dayOf(wallClock: string): string {
  return wallClock.slice(0, 10);
}
