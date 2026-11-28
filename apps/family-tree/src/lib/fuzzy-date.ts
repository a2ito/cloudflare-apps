/**
 * 生年月日・没年月日は "1950" / "1950-04" / "1950-04-01" のどれでも持てる。
 * 昔の人ほど年しか分からないため。
 */

const PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/** 年・年月・年月日のいずれかで、実在する暦か */
export function isFuzzyDate(value: string): boolean {
  const m = PATTERN.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  if (year < 1) return false;
  if (m[2] === undefined) return true;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return false;
  if (m[3] === undefined) return true;
  const day = Number(m[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  // 2 月 30 日のような存在しない日付を弾く。0〜99 年は Date.UTC が 1900 年台に読み替えるので直す
  probe.setUTCFullYear(year);
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/** "1950-04-01" -> "1950年4月1日"、"1950" -> "1950年" */
export function formatFuzzyDate(value: string): string {
  const m = PATTERN.exec(value);
  if (!m) return value;
  const parts = [`${Number(m[1])}年`];
  if (m[2] !== undefined) parts.push(`${Number(m[2])}月`);
  if (m[3] !== undefined) parts.push(`${Number(m[3])}日`);
  return parts.join("");
}

/** 比較用に、欠けた月日を最小値で埋めた文字列にする（"1950" -> "1950-00-00"） */
function sortKey(value: string): string {
  const [y, mo = "00", d = "00"] = value.split("-");
  return `${y}-${mo}-${d}`;
}

/** 没年が生年より前になっていないか。どちらかが無ければ確かめようがないので通す */
export function isLifespanOrdered(
  birth: string | null,
  death: string | null,
): boolean {
  if (!birth || !death) return true;
  // 粒度が違うと比べられない部分がある（"1950" と "1950-04"）。分かる範囲で前後していなければ通す
  const len = Math.min(birth.length, death.length);
  return sortKey(birth).slice(0, len) <= sortKey(death).slice(0, len);
}

/** ノードに出す短い生没年。"1950–2020" / "1950–" / "–2020" */
export function lifespanLabel(
  birth: string | null,
  death: string | null,
): string | null {
  const year = (v: string | null) => (v ? v.slice(0, 4) : "");
  if (!birth && !death) return null;
  return `${year(birth)}–${year(death)}`;
}
