/** 簡易フィルタの項目が使う URL パラメータの接頭辞。チップは in_ / min_ / max_ / has_ のどれかを書き換える */
const PREFIXES = ["in_", "min_", "max_", "has_"] as const;

/** 簡易フィルタに出している項目とメーカーの条件が使う URL パラメータの名前 */
function quickKeys(fieldIds: readonly number[]): Set<string> {
  return new Set([
    "maker",
    ...fieldIds.flatMap((id) => PREFIXES.map((p) => `${p}${id}`)),
  ]);
}

/** 簡易フィルタに出している項目とメーカーの条件だけを、URL の検索パラメータから抜き出す */
export function pickQuickParams(
  search: URLSearchParams,
  fieldIds: readonly number[],
): [string, string][] {
  const keys = quickKeys(fieldIds);
  // 空の値と has_<id>=0 は「外した」印で、条件ではない
  return [...search.entries()].filter(
    ([k, v]) => keys.has(k) && v !== "" && !(k.startsWith("has_") && v === "0"),
  );
}

/**
 * 簡易フィルタの条件を URL で指定しているか。値が空でもキーがあれば指定したとみなす。
 * 絞り込みのフォームで外して適用すると `max_4=` や `has_5=0` のように届くため、
 * これを「条件なしで開いた」と取り違えて、保存しておいた条件を戻さないようにする
 */
export function hasQuickKeys(
  search: URLSearchParams,
  fieldIds: readonly number[],
): boolean {
  const keys = quickKeys(fieldIds);
  return [...search.keys()].some((k) => keys.has(k));
}

/** 保存しておいた値を読む。壊れていたら何も保存していない扱いにする */
export function parseSavedQuickParams(raw: string | null): [string, string][] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (e): e is [string, string] =>
        Array.isArray(e) &&
        e.length === 2 &&
        typeof e[0] === "string" &&
        typeof e[1] === "string",
    );
  } catch {
    return [];
  }
}

/** 今の URL に保存しておいた条件を足した検索文字列 */
export function withQuickParams(
  search: URLSearchParams,
  saved: readonly [string, string][],
): string {
  const next = new URLSearchParams(search);
  for (const [k, v] of saved) next.append(k, v);
  return next.toString();
}

/** 簡易フィルタを畳んでいるかの保存値を読む。保存が無い・読めないときは開いておく */
export function parseQuickFiltersOpen(raw: string | null): boolean {
  return raw !== "0";
}
