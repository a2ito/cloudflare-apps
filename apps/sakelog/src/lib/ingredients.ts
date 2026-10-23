/**
 * 材料タグの入力。
 *
 * ブドウ品種・ホップ・酒米・焼酎の原料・ジンのボタニカルを同じ形で扱う。
 * どれも「1 本に複数ある」「名前で絞り込みたい」という点が同じなので分けない。
 * 呼び方と入力候補だけ種類ごとに変える（src/lib/categories.ts）。
 *
 * フォームでは 1 つの欄にカンマ区切りで書かせ、ここで配列に直す。サーバーアクションからも
 * クライアントの入力欄からも使うため、env にも drizzle にも触れない。
 */

/** 1 本に登録できる材料の数。ブレンドやボタニカルでもこれを超えることはまず無い */
export const MAX_INGREDIENTS = 12;

/** 1 つの材料名の長さの上限 */
export const MAX_INGREDIENT_LENGTH = 50;

/** "カベルネ・ソーヴィニヨン, メルロー" -> ["カベルネ・ソーヴィニヨン", "メルロー"] */
export function parseIngredients(input: string | undefined | null): string[] {
  if (!input) return [];
  const names: string[] = [];
  // 日本語で書くと読点で区切られることがあるので、どちらも受ける
  for (const raw of input.split(/[,、]/)) {
    const name = raw.trim();
    if (name === "" || name.length > MAX_INGREDIENT_LENGTH) continue;
    // 同じ材料を 2 度書かれても DB の一意制約に当てない
    if (!names.includes(name)) names.push(name);
  }
  return names.slice(0, MAX_INGREDIENTS);
}

/** 保存済みの材料を入力欄に戻す */
export function formatIngredients(names: readonly string[]): string {
  return names.join(", ");
}
