// 為替レートと精算通貨への換算（純粋関数）。
// レートは「外貨 1 単位あたりの精算通貨の額」を 10 進数の文字列で持つ（例: 1 USD = "150.25" JPY）。
// 浮動小数を通さず BigInt で計算し、換算結果は精算通貨の最小単位の整数にする。
import { getCurrency } from "./currency";

// レートの小数部の最大桁数
export const RATE_MAX_DECIMALS = 6;
// レートの整数部の最大桁数（1 BTC 相当でも収まる程度）
const RATE_MAX_INT_DIGITS = 9;

// 入力文字列を正規化したレート文字列にする。不正・0 以下なら null。
export function parseRate(input: string): string | null {
  const trimmed = input.trim().replace(/,/g, "");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) return null;
  const intPart = match[1].replace(/^0+(?=\d)/, "");
  const fracPart = (match[2] ?? "").replace(/0+$/, "");
  if (intPart.length > RATE_MAX_INT_DIGITS) return null;
  if (fracPart.length > RATE_MAX_DECIMALS) return null;
  if (/^0*$/.test(intPart + fracPart)) return null;
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

// 外貨の最小単位の金額を、レートで精算通貨の最小単位に換算する（四捨五入）。
export function convertToBase(
  amountMinor: number,
  fromCode: string,
  baseCode: string,
  rate: string,
): number {
  if (fromCode === baseCode) return amountMinor;
  const [intPart, fracPart = ""] = rate.split(".");
  const rateScaled = BigInt(intPart + fracPart);
  const rateScale = 10n ** BigInt(fracPart.length);
  const fromScale = 10n ** BigInt(getCurrency(fromCode).decimals);
  const baseScale = 10n ** BigInt(getCurrency(baseCode).decimals);

  const sign = amountMinor < 0 ? -1n : 1n;
  const numerator = BigInt(Math.abs(amountMinor)) * rateScaled * baseScale;
  const denominator = fromScale * rateScale;
  const rounded = (numerator * 2n + denominator) / (denominator * 2n);
  return Number(sign * rounded);
}
