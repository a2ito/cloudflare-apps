/**
 * 折れ線グラフの座標計算。描画（components/line-chart.tsx）から分けてテストできるようにする。
 */

export type ChartPoint = { t: number; v: number | null };

export type Segment = { t: number; v: number }[];

/**
 * 線を区切る。値が無い点、または前の点から maxGap 秒より空いたところで切る。
 * 計測が途切れた時間帯を線でつなぐと「その間も繋がっていた」ように見えてしまうため。
 */
export function toSegments(
  points: readonly ChartPoint[],
  maxGap: number,
): Segment[] {
  const segments: Segment[] = [];
  let current: Segment = [];
  let prevT: number | null = null;
  for (const p of points) {
    const gap = prevT !== null && p.t - prevT > maxGap;
    if (p.v === null || gap) {
      if (current.length > 0) segments.push(current);
      current = [];
    }
    if (p.v !== null) current.push({ t: p.t, v: p.v });
    prevT = p.t;
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

/** 値の範囲。上下に少し余白をつけ、全部同じ値でも幅が 0 にならないようにする */
export function valueDomain(
  values: readonly number[],
  options: { includeZero?: boolean } = {},
): [number, number] | null {
  if (values.length === 0) return null;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (options.includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) {
    // includeZero の量（損失率・速度）は負にならないので、全部 0 のときも 0 から上に幅を取る
    return options.includeZero && min === 0 ? [0, 1] : [min - 1, max + 1];
  }
  const pad = (max - min) * 0.1;
  return [
    options.includeZero && min === 0 ? 0 : min - pad,
    options.includeZero && max === 0 ? 0 : max + pad,
  ];
}
