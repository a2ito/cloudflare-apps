import { MAX_BULK_LINES, MAX_SENTENCE } from "./limits";

export type SentencePair = { ja: string; en: string };

/**
 * まとめて登録の入力を読む。1 行に「日本文<タブ>英文」。
 *
 * 区切りをタブにしたのは、スプレッドシートの 2 列をコピーするとそのまま
 * この形になるから。英文にはカンマやスラッシュが入るので区切りに使えない。
 * 空行は飛ばす。1 行でも崩れていれば何も登録せず、その行を知らせる。
 */
export function parseBulk(
  text: string,
): { ok: true; pairs: SentencePair[] } | { ok: false; error: string } {
  const lines = text.split(/\r?\n/);
  const pairs: SentencePair[] = [];
  for (const [i, line] of lines.entries()) {
    if (line.trim() === "") continue;
    const lineNo = i + 1;
    const tab = line.indexOf("\t");
    if (tab === -1)
      return {
        ok: false,
        error: `${lineNo} 行目: 日本文と英文をタブで区切ってください`,
      };
    const ja = line.slice(0, tab).trim();
    const en = line.slice(tab + 1).trim();
    if (ja === "" || en === "")
      return {
        ok: false,
        error: `${lineNo} 行目: 日本文と英文の両方を入れてください`,
      };
    if (ja.length > MAX_SENTENCE || en.length > MAX_SENTENCE) {
      return {
        ok: false,
        error: `${lineNo} 行目: 1 文は ${MAX_SENTENCE} 文字までです`,
      };
    }
    pairs.push({ ja, en });
  }
  if (pairs.length === 0) return { ok: false, error: "登録する文がありません" };
  if (pairs.length > MAX_BULK_LINES)
    return {
      ok: false,
      error: `一度に登録できるのは ${MAX_BULK_LINES} 行までです`,
    };
  return { ok: true, pairs };
}
