/** 簡易フィルタの項目が使う URL パラメータの接頭辞。チップは in_ / min_ / max_ / has_ のどれかを書き換える */
const PREFIXES = ["in_", "min_", "max_", "has_"] as const;

/** 簡易フィルタに出している項目の条件だけを、URL の検索パラメータから抜き出す */
export function pickQuickParams(search: URLSearchParams, fieldIds: readonly number[]): [string, string][] {
	const keys = new Set(fieldIds.flatMap((id) => PREFIXES.map((p) => `${p}${id}`)));
	return [...search.entries()].filter(([k, v]) => keys.has(k) && v !== "");
}

/** 保存しておいた値を読む。壊れていたら何も保存していない扱いにする */
export function parseSavedQuickParams(raw: string | null): [string, string][] {
	if (!raw) return [];
	try {
		const value: unknown = JSON.parse(raw);
		if (!Array.isArray(value)) return [];
		return value.filter((e): e is [string, string] => Array.isArray(e) && e.length === 2 && typeof e[0] === "string" && typeof e[1] === "string");
	} catch {
		return [];
	}
}

/** 今の URL に保存しておいた条件を足した検索文字列 */
export function withQuickParams(search: URLSearchParams, saved: readonly [string, string][]): string {
	const next = new URLSearchParams(search);
	for (const [k, v] of saved) next.append(k, v);
	return next.toString();
}
