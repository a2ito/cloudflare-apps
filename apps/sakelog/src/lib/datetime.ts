/**
 * 日付の扱いは 2 種類ある。
 *  - drunkAt: 飲んだ日（"2026-09-23"）。何時に飲んだかまでは要らないので日付だけ持つ。
 *    タイムゾーン変換をせず、入力された文字列をそのまま保持する。
 *  - createdAt / updatedAt: 監査用の UTC ISO 文字列。表示時に日本時間へ直す。
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** <input type="date"> の値として妥当か */
export function isDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // 2 月 30 日のような存在しない日付を弾く
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

/** 日時が付いていても date が扱える形に丸める */
export function toDate(value: string): string | null {
  const trimmed = value.trim().slice(0, 10);
  return isDate(trimmed) ? trimmed : null;
}

/** "2026-09-23" -> "2026/9/23" */
export function formatDate(value: string): string {
  if (!isDate(value)) return value;
  const [y, m, d] = value.split("-");
  return `${y}/${Number(m)}/${Number(d)}`;
}

/** UTC ISO 文字列を日本時間の "2026/09/23 21:30" にする */
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

/** 新規入力欄の初期値に使う、いまの日本時間の日付 */
export function today(now: Date = new Date()): string {
  // en-CA は YYYY-MM-DD で出るので <input type="date"> にそのまま渡せる
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** ヴィンテージ・蒸留年として受け付ける範囲。将来の年は打ち間違いとして弾く */
export const MIN_YEAR = 1900;

export function maxYear(now: Date = new Date()): number {
  return Number(today(now).slice(0, 4));
}
