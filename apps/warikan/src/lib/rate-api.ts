// 為替レートの自動取得。キー不要で台湾ドルまで揃う fawazahmed0/exchange-api を使う。
// https://github.com/fawazahmed0/exchange-api
// レスポンスは {"date":"2026-10-03","usd":{"jpy":149.9,...}} の形で、1 日 1 回更新される。
import { parseRate, RATE_MAX_DECIMALS } from "./exchange";

// 本家の案内に従い、CDN が落ちていたら Cloudflare Pages のミラーを使う
const ENDPOINTS = [
  (code: string) =>
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${code}.json`,
  (code: string) =>
    `https://latest.currency-api.pages.dev/v1/currencies/${code}.json`,
];

const TIMEOUT_MS = 5000;

export interface FetchedRate {
  rate: string; // 外貨 1 単位あたりの精算通貨の額
  date: string; // レートの基準日 (YYYY-MM-DD)
}

// API の浮動小数を、有効数字 8 桁に丸めたレート文字列にする。扱えない値なら null。
export function toRateString(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return parseRate(Number(value.toPrecision(8)).toFixed(RATE_MAX_DECIMALS));
}

// from 1 単位あたりの to の額を取得する。どの取得先でも取れなければ null。
export async function fetchRate(
  from: string,
  to: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedRate | null> {
  const fromKey = from.toLowerCase();
  const toKey = to.toLowerCase();
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetchImpl(endpoint(fromKey), {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as {
        date?: unknown;
        [key: string]: unknown;
      };
      const table = body[fromKey] as Record<string, unknown> | undefined;
      const value = table?.[toKey];
      const rate = typeof value === "number" ? toRateString(value) : null;
      if (rate && typeof body.date === "string") {
        return { rate, date: body.date };
      }
    } catch {
      // タイムアウトや JSON の破損は次の取得先へ
    }
  }
  return null;
}

// 複数の外貨のレートをまとめて取得する。取れなかった通貨は結果に含めない。
export async function fetchRates(
  froms: string[],
  to: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Map<string, FetchedRate>> {
  const results = await Promise.all(
    froms.map(async (from) => [from, await fetchRate(from, to, fetchImpl)] as const),
  );
  const rates = new Map<string, FetchedRate>();
  for (const [from, rate] of results) {
    if (rate) rates.set(from, rate);
  }
  return rates;
}
