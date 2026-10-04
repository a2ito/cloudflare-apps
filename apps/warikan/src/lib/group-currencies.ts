// グループで使う外貨の登録とレートの自動取得（サーバー側から呼ぶ）。
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { fetchRates } from "./rate-api";

type Db = ReturnType<typeof getDb>;

// 1 グループに登録できる外貨の上限（精算通貨は別枠）
export const MAX_GROUP_CURRENCIES = 7;

// 外貨を登録し、レートを自動取得して入れる。取得できなかった通貨はレート未設定で残す。
export async function registerCurrencies(
  db: Db,
  groupId: string,
  baseCurrency: string,
  currencies: string[],
) {
  const targets = [...new Set(currencies)].filter((c) => c !== baseCurrency);
  if (targets.length === 0) return;
  const fetched = await fetchRates(targets, baseCurrency);
  const updatedAt = new Date();
  for (const currency of targets) {
    const rate = fetched.get(currency);
    await db
      .insert(schema.exchangeRates)
      .values({
        groupId,
        currency,
        rate: rate?.rate ?? null,
        rateSource: "auto",
        rateDate: rate?.date ?? null,
        updatedAt,
      })
      .onConflictDoNothing();
  }
}

// 登録済みの外貨のレートを最新に取り直す。取得できなかった通貨は今のレートを残す。
// 戻り値は取得できなかった通貨。
export async function refreshRates(
  db: Db,
  groupId: string,
  baseCurrency: string,
  currencies: string[],
): Promise<string[]> {
  const fetched = await fetchRates(currencies, baseCurrency);
  const updatedAt = new Date();
  for (const [currency, rate] of fetched) {
    await db
      .update(schema.exchangeRates)
      .set({
        rate: rate.rate,
        rateSource: "auto",
        rateDate: rate.date,
        updatedAt,
      })
      .where(
        and(
          eq(schema.exchangeRates.groupId, groupId),
          eq(schema.exchangeRates.currency, currency),
        ),
      );
  }
  return currencies.filter((c) => !fetched.has(c));
}
