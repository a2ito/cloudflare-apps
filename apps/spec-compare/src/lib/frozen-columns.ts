/** 何も選んでいないときは、最安値の列まで左に固定する */
export const DEFAULT_LAST_FROZEN = "price";

/** 商品の列は何の行か分かるよう、いつも固定する */
const ALWAYS_FROZEN = "name";

/**
 * 左から順に並ぶ列のうち、固定する列とその left の位置。
 * last が見つからない（コスパ列を出していない、項目を消した）ときは既定の列まで固定する
 */
export function frozenOffsets(
  columns: readonly { key: string; width: number }[],
  last: string,
): Map<string, number> {
  const keys = columns.map((c) => c.key);
  let end = keys.indexOf(last);
  if (end < 0) end = keys.indexOf(DEFAULT_LAST_FROZEN);
  if (end < 0) end = keys.indexOf(ALWAYS_FROZEN);
  const offsets = new Map<string, number>();
  let left = 0;
  for (const c of columns.slice(0, end + 1)) {
    offsets.set(c.key, left);
    left += c.width;
  }
  return offsets;
}

/**
 * 列のピンを押したときの、新しい「ここまで固定」の列。
 * 固定していない列を押すとそこまで固定し、固定の右端の列を押すと 1 つ左までに戻す。
 * 固定の途中の列を押したときもそこまでに縮める
 */
export function toggleFrozen(
  columns: readonly string[],
  current: string,
  pressed: string,
): string {
  const at = columns.indexOf(pressed);
  if (at < 0) return current;
  const end = columns.indexOf(current);
  if (at === end) return columns[Math.max(0, at - 1)] ?? ALWAYS_FROZEN;
  return pressed;
}
