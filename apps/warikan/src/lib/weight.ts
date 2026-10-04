// 割り勘の傾斜（重み）。画面では 0.5 刻みの倍率（例 1.5）で扱い、
// 保存と計算は 10 倍した整数で行う。金額と同じく浮動小数を持ち込まないため。

export const WEIGHT_SCALE = 10;
// 傾斜をつけないときの重み（倍率 1）
export const DEFAULT_WEIGHT = WEIGHT_SCALE;
export const MIN_WEIGHT = 5; // 0.5
export const MAX_WEIGHT = 100; // 10
const WEIGHT_STEP = 5; // 0.5 刻み

/** 入力された倍率（例 "1.5"）を保存用の整数にする。範囲外や 0.5 刻みでなければ null */
export function parseWeight(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d)?$/.test(trimmed)) return null;
  const [intPart, fracPart = "0"] = trimmed.split(".");
  const weight = Number(intPart) * WEIGHT_SCALE + Number(fracPart);
  if (weight < MIN_WEIGHT || weight > MAX_WEIGHT) return null;
  if (weight % WEIGHT_STEP !== 0) return null;
  return weight;
}

/** 保存用の整数を倍率の表示（例 "1.5"）にする */
export function formatWeight(weight: number): string {
  const intPart = Math.floor(weight / WEIGHT_SCALE);
  const fracPart = weight % WEIGHT_SCALE;
  return fracPart === 0 ? String(intPart) : `${intPart}.${fracPart}`;
}
