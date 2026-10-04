// 対応通貨の定義。decimals は最小単位(minor units)の小数桁数。
// TWD・MNT は ISO 4217 では 2 桁だが、実際の支払いでは小数を使わないので 0 にしている。
export type CurrencyCode =
  | "JPY"
  | "USD"
  | "EUR"
  | "GBP"
  | "KRW"
  | "CNY"
  | "TWD"
  | "THB"
  | "VND"
  | "MNT"
  | "AUD";

export interface CurrencyInfo {
  code: CurrencyCode;
  label: string;
  symbol: string;
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  JPY: { code: "JPY", label: "日本円", symbol: "¥", decimals: 0 },
  USD: { code: "USD", label: "米ドル", symbol: "$", decimals: 2 },
  EUR: { code: "EUR", label: "ユーロ", symbol: "€", decimals: 2 },
  GBP: { code: "GBP", label: "英ポンド", symbol: "£", decimals: 2 },
  KRW: { code: "KRW", label: "韓国ウォン", symbol: "₩", decimals: 0 },
  CNY: { code: "CNY", label: "人民元", symbol: "元", decimals: 2 },
  TWD: { code: "TWD", label: "台湾ドル", symbol: "NT$", decimals: 0 },
  THB: { code: "THB", label: "タイバーツ", symbol: "฿", decimals: 2 },
  VND: { code: "VND", label: "ベトナムドン", symbol: "₫", decimals: 0 },
  MNT: { code: "MNT", label: "モンゴルトゥグルグ", symbol: "₮", decimals: 0 },
  AUD: { code: "AUD", label: "豪ドル", symbol: "A$", decimals: 2 },
};

export const CURRENCY_LIST: CurrencyInfo[] = Object.values(CURRENCIES);

export function isCurrencyCode(value: string): value is CurrencyCode {
  return value in CURRENCIES;
}

export function getCurrency(code: string): CurrencyInfo {
  return isCurrencyCode(code) ? CURRENCIES[code] : CURRENCIES.JPY;
}

// 表示用の入力文字列(例 "1234.56")を最小単位の整数に変換する。不正なら null。
export function parseAmountToMinor(input: string, code: string): number | null {
  const { decimals } = getCurrency(code);
  const trimmed = input.trim().replace(/,/g, "");
  if (trimmed === "") return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [intPart, fracPart = ""] = trimmed.split(".");
  if (fracPart.length > decimals) return null;
  const padded = fracPart.padEnd(decimals, "0");
  const minor = Number(intPart) * 10 ** decimals + Number(padded || "0");
  if (!Number.isSafeInteger(minor) || minor <= 0) return null;
  return minor;
}

// 最小単位の整数を表示用の金額文字列(記号付き)に整形する。
export function formatAmount(minor: number, code: string): string {
  const { symbol, decimals } = getCurrency(code);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const divisor = 10 ** decimals;
  const major = Math.floor(abs / divisor);
  const frac = abs % divisor;
  const majorStr = major.toLocaleString("en-US");
  const fracStr = decimals > 0 ? "." + String(frac).padStart(decimals, "0") : "";
  return `${sign}${symbol}${majorStr}${fracStr}`;
}
