/**
 * 価格の記録日は "2026-10-12" の文字列で持つ。いつ見た値段かが分かれば足りるため、時刻は持たない
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** <input type="date"> の値として妥当か */
export function isDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  // 2 月 30 日のような存在しない日付を弾く
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

/** いまの日本時間の日付。Workers は UTC で動くため、そのまま Date を使うと朝 9 時まで前日になる */
export function today(now: Date = new Date()): string {
  // en-CA は YYYY-MM-DD で出るので <input type="date"> にそのまま渡せる
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * D1 の datetime('now')（"2026-10-12 15:30:00"、UTC）を日本時間の日付にする。
 * UTC の日付のままだと、日本時間の朝 9 時より前に登録した商品が前日になるため。読めない値はそのまま返す
 */
export function jstDateOf(utc: string): string {
  const at = new Date(`${utc.replace(" ", "T")}Z`);
  return Number.isNaN(at.getTime()) ? utc : today(at);
}
