/**
 * 「今日やること」を決める規則。DB に触らない純粋な関数だけを置く。
 */

/**
 * 前回のメニューの次に回すメニュー。menus は作った順（id 昇順）に並んでいる前提。
 *
 * 「前回より後に作ったメニューのうち最初のもの。無ければ先頭」とすると、
 * 前回のメニューが消されていても順番が崩れない（消えた位置の次から続く）。
 */
export function nextMenu<T extends { id: number }>(
  menus: readonly T[],
  lastMenuId: number | null | undefined,
): T | undefined {
  if (lastMenuId == null) return menus[0];
  return menus.find((m) => m.id > lastMenuId) ?? menus[0];
}

export type Goal = {
  weight: number;
  targetSets: number;
  targetReps: number;
  increment: number;
};
export type DoneSet = { weight: number; reps: number };

/**
 * 記録を踏まえた次回の重量。
 *
 * 予定の重量以上で目標回数に届いたセットが、目標のセット数ぶんあれば上げ幅だけ足す（漸進的過負荷）。
 * 自分で重量を下げた日や、回数が足りなかった日は据え置く。
 */
export function nextWeight(goal: Goal, sets: readonly DoneSet[]): number {
  const cleared = sets.filter(
    (s) => s.weight >= goal.weight && s.reps >= goal.targetReps,
  ).length;
  // 重量と上げ幅は 0.25kg 刻み（2 進数で割り切れる）に限っているので、足しても誤差は出ない
  return cleared >= goal.targetSets
    ? goal.weight + goal.increment
    : goal.weight;
}

/** 重量の表示。整数なら小数点を出さない（60 / 62.5） */
export function formatWeight(kg: number): string {
  return `${Number.isInteger(kg) ? kg : kg.toFixed(2).replace(/0+$/, "")}kg`;
}
