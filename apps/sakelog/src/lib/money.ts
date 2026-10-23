/**
 * 金額は「最小通貨単位の整数」で保持する（浮動小数の誤差を持ち込まないため）。
 * 例: 12.34 USD -> 1234 / 1200 JPY -> 1200
 *
 * 国内で買うことが多いので既定は円だが、旅行先や輸入元の値段をそのまま
 * 残したいことがあるため通貨は選べるようにしてある。
 */

/** 小数点以下の桁数が 0 の通貨。ここに無いものは 2 桁として扱う */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "JPY",
  "KRW",
  "VND",
  "CLP",
  "ISK",
  "PYG",
  "RWF",
  "UGX",
  "VUV",
  "XAF",
  "XOF",
]);

export const DEFAULT_CURRENCY = "JPY";

/** よく使う通貨（フォームの選択肢用） */
export const CURRENCY_OPTIONS = [
  { code: "JPY", label: "日本円 (JPY)" },
  { code: "EUR", label: "ユーロ (EUR)" },
  { code: "USD", label: "米ドル (USD)" },
  { code: "GBP", label: "英ポンド (GBP)" },
  { code: "AUD", label: "豪ドル (AUD)" },
  { code: "CLP", label: "チリペソ (CLP)" },
  { code: "ZAR", label: "南アフリカランド (ZAR)" },
] as const;

/** 選択肢にある通貨は日本語名で、それ以外はコードのまま見せる */
export function currencyLabel(code: string): string {
  const normalized = normalizeCurrency(code);
  return (
    CURRENCY_OPTIONS.find((c) => c.code === normalized)?.label ?? normalized
  );
}

export function normalizeCurrency(code: string): string {
  return code.trim().toUpperCase();
}

export function currencyDigits(code: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(normalizeCurrency(code)) ? 0 : 2;
}

/**
 * 「1,234.50」のような入力を最小通貨単位の整数に変換する。
 * 解釈できない場合や負数は null を返す（呼び出し側でエラーにする）。
 */
export function parseAmountToMinor(input: string, code: string): number | null {
  const cleaned = input
    .trim()
    .replace(/[,\s]/g, "")
    .replace(/^[¥$€£]/, "");
  if (cleaned === "" || !/^\d+(\.\d+)?$/.test(cleaned)) return null;

  const digits = currencyDigits(code);
  const [intPart, fracPart = ""] = cleaned.split(".");
  if (fracPart.length > digits) {
    // 表現できない桁は四捨五入する（例: JPY に 100.4 が来たら 100）
    const scaled = Math.round(Number(cleaned) * 10 ** digits);
    return Number.isSafeInteger(scaled) ? scaled : null;
  }
  const padded = fracPart.padEnd(digits, "0");
  const minor = Number(`${intPart}${padded}`);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** 最小通貨単位の整数を入力欄に戻す（例: 1234 USD -> "12.34"） */
export function minorToInput(minor: number, code: string): string {
  const digits = currencyDigits(code);
  if (digits === 0) return String(minor);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const unit = 10 ** digits;
  return `${sign}${Math.floor(abs / unit)}.${String(abs % unit).padStart(digits, "0")}`;
}

/** 通貨記号つきで表示する（例: ¥1,200 / $12.34） */
export function formatMoney(minor: number, code: string): string {
  const currency = normalizeCurrency(code);
  const digits = currencyDigits(currency);
  const value = minor / 10 ** digits;
  try {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    // 未知の通貨コードでも落とさない
    return `${value.toFixed(digits)} ${currency}`;
  }
}
