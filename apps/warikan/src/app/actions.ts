"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { isCurrencyCode } from "@/lib/currency";
import { MAX_GROUP_CURRENCIES, registerCurrencies } from "@/lib/group-currencies";

const createGroupSchema = z.object({
  name: z.string().trim().min(1, "グループ名を入力してください").max(100),
  currency: z.string().refine(isCurrencyCode, "対応していない通貨です"),
  // 精算通貨のほかに使う外貨
  currencies: z
    .array(z.string().refine(isCurrencyCode, "対応していない通貨です"))
    .max(MAX_GROUP_CURRENCIES, `外貨は ${MAX_GROUP_CURRENCIES} つまでです`),
});

export async function createGroup(formData: FormData) {
  const parsed = createGroupSchema.safeParse({
    name: formData.get("name"),
    currency: formData.get("currency"),
    currencies: formData.getAll("currencies").map(String),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "入力が不正です");
  }

  const db = getDb();
  const id = crypto.randomUUID();
  await db.insert(schema.groups).values({
    id,
    name: parsed.data.name,
    currency: parsed.data.currency,
    createdAt: new Date(),
  });
  await registerCurrencies(
    db,
    id,
    parsed.data.currency,
    parsed.data.currencies,
  );

  redirect(`/g/${id}`);
}
