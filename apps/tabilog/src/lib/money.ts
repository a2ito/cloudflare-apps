/**
 * 金額は「最小通貨単位の整数」で保持する（浮動小数の誤差を持ち込まないため）。
 * 例: 12.34 USD -> 1234 / 1200 JPY -> 1200
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

/** 1 つの旅行に登録できる現地通貨の上限（円は別枠で常に使える） */
export const MAX_TRIP_CURRENCIES = 10;

/** よく使う通貨（フォームの選択肢用） */
export const CURRENCY_OPTIONS = [
  { code: "JPY", label: "日本円 (JPY)" },
  { code: "USD", label: "米ドル (USD)" },
  { code: "EUR", label: "ユーロ (EUR)" },
  { code: "KRW", label: "韓国ウォン (KRW)" },
  { code: "TWD", label: "台湾ドル (TWD)" },
  { code: "THB", label: "タイバーツ (THB)" },
  { code: "SGD", label: "シンガポールドル (SGD)" },
  { code: "GBP", label: "英ポンド (GBP)" },
  { code: "AUD", label: "豪ドル (AUD)" },
  { code: "CNY", label: "中国元 (CNY)" },
  { code: "VND", label: "ベトナムドン (VND)" },
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

/**
 * 現地通貨の最小単位金額を円に換算する（rate = 現地通貨 1 単位あたりの円）。
 * 戻り値は円の整数。
 */
export function toJpy(minor: number, code: string, rateToJpy: number): number {
  const digits = currencyDigits(code);
  return Math.round((minor / 10 ** digits) * rateToJpy);
}

export function formatJpy(yen: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(yen);
}

/** 円換算が意味を持つのは現地通貨が円以外のときだけ */
export function needsJpyConversion(code: string): boolean {
  return normalizeCurrency(code) !== "JPY";
}

export function sumMinor(amounts: readonly number[]): number {
  return amounts.reduce((acc, n) => acc + n, 0);
}

/* ── 通貨が混ざった記録の集計 ─────────────────────────────── */

/** 金額と、それを支払った通貨の組 */
export type Amount = { minor: number; currency: string };

/** 通貨コード -> 現地通貨 1 単位あたりの円。円は常にレート 1 なので含めなくてよい */
export type Rates = Readonly<Record<string, number>>;

/** 旅行に登録された通貨のリストからレート表を作る */
export function toRates(
  currencies: readonly { code: string; rateToJpy: number }[],
): Rates {
  const rates: Record<string, number> = {};
  for (const c of currencies) rates[normalizeCurrency(c.code)] = c.rateToJpy;
  return rates;
}

/** 円に換算する。レートの分からない通貨は換算できないので 0 とする */
export function amountToJpy(amount: Amount, rates: Rates): number {
  const currency = normalizeCurrency(amount.currency);
  if (currency === DEFAULT_CURRENCY) return amount.minor;
  const rate = rates[currency];
  return rate === undefined ? 0 : toJpy(amount.minor, currency, rate);
}

/** 通貨が混ざっていても合計は円で持つのが一番ずれない */
export function sumAsJpy(amounts: readonly Amount[], rates: Rates): number {
  return amounts.reduce((acc, a) => acc + amountToJpy(a, rates), 0);
}

/** 通貨ごとに合計する。表示順は渡された順のまま */
export function sumByCurrency(
  amounts: readonly Amount[],
): { currency: string; minor: number }[] {
  const totals = new Map<string, number>();
  for (const a of amounts) {
    const code = normalizeCurrency(a.currency);
    totals.set(code, (totals.get(code) ?? 0) + a.minor);
  }
  return [...totals.entries()].map(([currency, minor]) => ({
    currency,
    minor,
  }));
}
