/**
 * 食べた日は "2026-09-25" の文字列で持つ。何時に食べたかまでは要らず、
 * 1 日の合計を出す単位として日付があれば足りるため。タイムゾーン変換はしない。
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** <input type="date"> や ?date= の値として妥当か */
export function isDate(value: string): boolean {
	if (!DATE.test(value)) return false;
	const [y, m, d] = value.split("-").map(Number);
	// 2 月 30 日のような存在しない日付を弾く
	const probe = new Date(Date.UTC(y, m - 1, d));
	return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
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

/** 日付を days 日ずらす。月末・年末・うるう年をまたいでも崩れないよう UTC の暦で計算する */
export function shiftDate(value: string, days: number): string {
	const [y, m, d] = value.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** "2026-09-25" -> "9/25（金）" */
export function formatDay(value: string): string {
	const [y, m, d] = value.split("-").map(Number);
	const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
	return `${m}/${d}（${weekday}）`;
}
