"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { isCurrencyCode, parseAmountToMinor } from "@/lib/currency";
import { parseRate } from "@/lib/exchange";
import {
  MAX_GROUP_CURRENCIES,
  refreshRates,
  registerCurrencies,
} from "@/lib/group-currencies";

async function getGroupOrThrow(groupId: string) {
  const db = getDb();
  const group = await db.query.groups.findFirst({
    where: eq(schema.groups.id, groupId),
  });
  if (!group) throw new Error("グループが見つかりません");
  return { db, group };
}

// --- メンバー ---

const addMemberSchema = z.object({
  name: z.string().trim().min(1, "名前を入力してください").max(50),
});

export async function addMember(groupId: string, formData: FormData) {
  const parsed = addMemberSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "入力が不正です");
  }
  const { db } = await getGroupOrThrow(groupId);
  await db.insert(schema.members).values({
    id: crypto.randomUUID(),
    groupId,
    name: parsed.data.name,
    createdAt: new Date(),
  });
  revalidatePath(`/g/${groupId}`);
}

export async function removeMember(groupId: string, formData: FormData) {
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) throw new Error("メンバーが指定されていません");
  const { db } = await getGroupOrThrow(groupId);

  // payer または participant として立替に紐づいている場合は削除不可
  const asPayer = await db.query.expenses.findFirst({
    where: and(
      eq(schema.expenses.groupId, groupId),
      eq(schema.expenses.payerId, memberId),
    ),
  });
  const asParticipant = await db.query.expenseParticipants.findFirst({
    where: eq(schema.expenseParticipants.memberId, memberId),
  });
  if (asPayer || asParticipant) {
    throw new Error(
      "このメンバーは立替に紐づいているため削除できません。先に該当の立替を削除してください。",
    );
  }

  await db
    .delete(schema.members)
    .where(
      and(eq(schema.members.id, memberId), eq(schema.members.groupId, groupId)),
    );
  revalidatePath(`/g/${groupId}`);
}

// --- 立替 ---

const expenseSchema = z.object({
  payerId: z.string().min(1, "支払った人を選択してください"),
  amount: z.string().min(1, "金額を入力してください"),
  currency: z.string().refine(isCurrencyCode, "対応していない通貨です"),
  description: z.string().trim().max(100).optional().default(""),
  participantIds: z.array(z.string()).min(1, "割り勘対象を1人以上選択してください"),
});

function parseExpenseForm(formData: FormData) {
  return expenseSchema.safeParse({
    payerId: formData.get("payerId"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    description: formData.get("description") ?? "",
    participantIds: formData.getAll("participantIds").map(String),
  });
}

async function assertMembersBelong(
  db: ReturnType<typeof getDb>,
  groupId: string,
  ids: string[],
) {
  const members = await db.query.members.findMany({
    where: eq(schema.members.groupId, groupId),
  });
  const valid = new Set(members.map((m) => m.id));
  for (const id of ids) {
    if (!valid.has(id)) throw new Error("不正なメンバーが指定されました");
  }
}

// 金額を立替の通貨の最小単位にする。通貨は精算通貨かグループに登録した外貨に限る。
async function parseExpenseAmount(
  db: ReturnType<typeof getDb>,
  groupId: string,
  baseCurrency: string,
  data: z.infer<typeof expenseSchema>,
): Promise<number> {
  if (data.currency !== baseCurrency) {
    const registered = await db.query.exchangeRates.findFirst({
      where: and(
        eq(schema.exchangeRates.groupId, groupId),
        eq(schema.exchangeRates.currency, data.currency),
      ),
    });
    if (!registered) throw new Error("このグループで使っていない通貨です");
  }
  const amount = parseAmountToMinor(data.amount, data.currency);
  if (amount === null) throw new Error("金額が不正です");
  return amount;
}

export async function addExpense(groupId: string, formData: FormData) {
  const parsed = parseExpenseForm(formData);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "入力が不正です");
  }
  const { db, group } = await getGroupOrThrow(groupId);

  const amount = await parseExpenseAmount(
    db,
    groupId,
    group.currency,
    parsed.data,
  );

  await assertMembersBelong(db, groupId, [
    parsed.data.payerId,
    ...parsed.data.participantIds,
  ]);

  const expenseId = crypto.randomUUID();
  await db.insert(schema.expenses).values({
    id: expenseId,
    groupId,
    payerId: parsed.data.payerId,
    amount,
    currency: parsed.data.currency,
    description: parsed.data.description,
    createdAt: new Date(),
  });
  await db.insert(schema.expenseParticipants).values(
    parsed.data.participantIds.map((memberId) => ({
      expenseId,
      memberId,
    })),
  );
  revalidatePath(`/g/${groupId}`);
}

export async function updateExpense(groupId: string, formData: FormData) {
  const expenseId = String(formData.get("expenseId") ?? "");
  if (!expenseId) throw new Error("立替が指定されていません");
  const parsed = parseExpenseForm(formData);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "入力が不正です");
  }
  const { db, group } = await getGroupOrThrow(groupId);

  const amount = await parseExpenseAmount(
    db,
    groupId,
    group.currency,
    parsed.data,
  );

  const existing = await db.query.expenses.findFirst({
    where: and(
      eq(schema.expenses.id, expenseId),
      eq(schema.expenses.groupId, groupId),
    ),
  });
  if (!existing) throw new Error("立替が見つかりません");

  await assertMembersBelong(db, groupId, [
    parsed.data.payerId,
    ...parsed.data.participantIds,
  ]);

  await db
    .update(schema.expenses)
    .set({
      payerId: parsed.data.payerId,
      amount,
      currency: parsed.data.currency,
      description: parsed.data.description,
    })
    .where(eq(schema.expenses.id, expenseId));
  await db
    .delete(schema.expenseParticipants)
    .where(eq(schema.expenseParticipants.expenseId, expenseId));
  await db.insert(schema.expenseParticipants).values(
    parsed.data.participantIds.map((memberId) => ({
      expenseId,
      memberId,
    })),
  );
  revalidatePath(`/g/${groupId}`);
}

export async function removeExpense(groupId: string, formData: FormData) {
  const expenseId = String(formData.get("expenseId") ?? "");
  if (!expenseId) throw new Error("立替が指定されていません");
  const { db } = await getGroupOrThrow(groupId);
  await db
    .delete(schema.expenseParticipants)
    .where(eq(schema.expenseParticipants.expenseId, expenseId));
  await db
    .delete(schema.expenses)
    .where(
      and(
        eq(schema.expenses.id, expenseId),
        eq(schema.expenses.groupId, groupId),
      ),
    );
  revalidatePath(`/g/${groupId}`);
}

// --- 通貨と為替レート ---

const currencySchema = z
  .string()
  .refine(isCurrencyCode, "対応していない通貨です");

export async function addCurrency(groupId: string, formData: FormData) {
  const parsed = currencySchema.safeParse(formData.get("currency"));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "入力が不正です");
  }
  const { db, group } = await getGroupOrThrow(groupId);
  if (parsed.data === group.currency) {
    throw new Error("精算通貨はすでに使えます");
  }
  const registered = await db.query.exchangeRates.findMany({
    where: eq(schema.exchangeRates.groupId, groupId),
  });
  if (registered.some((r) => r.currency === parsed.data)) {
    throw new Error("この通貨はすでに追加されています");
  }
  if (registered.length >= MAX_GROUP_CURRENCIES) {
    throw new Error(`外貨は ${MAX_GROUP_CURRENCIES} つまでです`);
  }
  await registerCurrencies(db, groupId, group.currency, [parsed.data]);
  revalidatePath(`/g/${groupId}`);
}

export async function removeCurrency(groupId: string, formData: FormData) {
  const parsed = currencySchema.safeParse(formData.get("currency"));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "入力が不正です");
  }
  const { db } = await getGroupOrThrow(groupId);
  const used = await db.query.expenses.findFirst({
    where: and(
      eq(schema.expenses.groupId, groupId),
      eq(schema.expenses.currency, parsed.data),
    ),
  });
  if (used) {
    throw new Error(
      "この通貨の立替があるため外せません。先に該当の立替を削除してください。",
    );
  }
  await db
    .delete(schema.exchangeRates)
    .where(
      and(
        eq(schema.exchangeRates.groupId, groupId),
        eq(schema.exchangeRates.currency, parsed.data),
      ),
    );
  revalidatePath(`/g/${groupId}`);
}

const rateSchema = z.object({
  currency: currencySchema,
  rate: z.string().min(1, "レートを入力してください"),
});

// レートを手入力で上書きする
export async function updateRate(groupId: string, formData: FormData) {
  const parsed = rateSchema.safeParse({
    currency: formData.get("currency"),
    rate: formData.get("rate"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "入力が不正です");
  }
  const { db } = await getGroupOrThrow(groupId);
  const rate = parseRate(parsed.data.rate);
  if (rate === null) throw new Error("為替レートが不正です");
  const updated = await db
    .update(schema.exchangeRates)
    .set({ rate, rateSource: "manual", rateDate: null, updatedAt: new Date() })
    .where(
      and(
        eq(schema.exchangeRates.groupId, groupId),
        eq(schema.exchangeRates.currency, parsed.data.currency),
      ),
    )
    .returning();
  if (updated.length === 0) throw new Error("このグループで使っていない通貨です");
  revalidatePath(`/g/${groupId}`);
}

// 登録済みの外貨のレートをすべて最新に取り直す（手入力したレートも上書きする）
export async function refreshGroupRates(groupId: string) {
  const { db, group } = await getGroupOrThrow(groupId);
  const registered = await db.query.exchangeRates.findMany({
    where: eq(schema.exchangeRates.groupId, groupId),
  });
  const failed = await refreshRates(
    db,
    groupId,
    group.currency,
    registered.map((r) => r.currency),
  );
  revalidatePath(`/g/${groupId}`);
  if (failed.length > 0) {
    throw new Error(
      `${failed.join(", ")} のレートを取得できませんでした。時間をおくか、手で入力してください。`,
    );
  }
}
