/**
 * 日時の扱いは 2 種類ある。
 *  - happenedAt: 現地の壁時計時刻（"2026-03-01T12:30"）。旅先では「現地の何時か」が意味を持つので
 *    タイムゾーン変換をせず、入力された文字列をそのまま保持する。
 *  - createdAt / updatedAt: 監査用の UTC ISO 文字列。表示時に日本時間へ直す。
 */

const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** <input type="datetime-local"> の値として妥当か */
export function isWallClock(value: string): boolean {
  if (!WALL_CLOCK.test(value)) return false;
  const [date, time] = value.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return false;
  // 2 月 30 日のような存在しない日付を弾く
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** 秒以下が付いていても datetime-local が扱える形に丸める */
export function toWallClock(value: string): string | null {
  const trimmed = value.trim().slice(0, 16);
  return isWallClock(trimmed) ? trimmed : null;
}

/** "2026-03-01T12:30" -> "3/1 12:30" */
export function formatWallClock(value: string): string {
  if (!isWallClock(value)) return value;
  const [date, time] = value.split("T");
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)} ${time}`;
}

/** "2026-03-01T12:30" -> "2026/3/1" */
export function formatWallClockDate(value: string): string {
  if (!isWallClock(value)) return value;
  const [y, m, d] = value.split("T")[0].split("-");
  return `${y}/${Number(m)}/${Number(d)}`;
}

/** UTC ISO 文字列を日本時間の "2026/03/01 21:30" にする */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** 旅行期間の表示。片方だけでも成立させる */
export function formatDateRange(
  start: string | null,
  end: string | null,
): string {
  const fmt = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${y}/${Number(m)}/${Number(day)}`;
  };
  if (start && end)
    return start === end ? fmt(start) : `${fmt(start)} 〜 ${fmt(end)}`;
  if (start) return `${fmt(start)} 〜`;
  if (end) return `〜 ${fmt(end)}`;
  return "日付未設定";
}

/** 新規入力欄の初期値に使う、いまの日本時間の壁時計文字列 */
export function nowWallClock(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
