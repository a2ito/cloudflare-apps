/**
 * 記録の種別と、画面に出すラベル。
 *
 * DB のスキーマ・入力の検証・フォームの選択肢・一覧の絞り込みで同じ並びを使うため、
 * ここ 1 か所に置く。Cloudflare の env にも drizzle にも触れないので、
 * クライアントコンポーネントからも読める。
 */

/** 保存する値。並び順はフォームの選択肢と絞り込みボタンの並びでもある */
export const ENTRY_KINDS = [
  "food",
  "shopping",
  "sightseeing",
  "other",
] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

const LABELS: Record<EntryKind, string> = {
  food: "🍜 食べた",
  shopping: "🛍️ 買った",
  sightseeing: "👀 見た",
  other: "📌 その他",
};

export const ENTRY_KIND_OPTIONS = ENTRY_KINDS.map((value) => ({
  value,
  label: LABELS[value],
}));

export function isEntryKind(value: string): value is EntryKind {
  return (ENTRY_KINDS as readonly string[]).includes(value);
}

/** 絵文字だけが欲しい場面（写真の無いカードの代わりの絵など）のために取り出す */
export function entryKindEmoji(kind: string): string {
  const [emoji] = entryKindLabel(kind).split(" ");
  // 知らない種別はラベルがそのまま返るので、絵文字が無ければ既定の印にする
  return isEntryKind(kind) && emoji ? emoji : "📌";
}

/** 知らない種別（古いデータなど）はそのまま出して、表示が消えないようにする */
export function entryKindLabel(kind: string): string {
  return isEntryKind(kind) ? LABELS[kind] : kind;
}

/**
 * 絵文字を外した名前。絵文字だけを見せる場所で、読み上げや吹き出しに使う。
 * 見た目に文字が出なくても何の種別かが伝わるようにするため。
 */
export function entryKindName(kind: string): string {
  const [, name] = entryKindLabel(kind).split(" ");
  return isEntryKind(kind) && name ? name : kind;
}
