"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { isCurrencyCode, parseAmountToMinor } from "@/lib/currency";
import { parseRate } from "@/lib/exchange";

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
  rate: z.string().optional().default(""),
  description: z.string().trim().max(100).optional().default(""),
  participantIds: z.array(z.string()).min(1, "割り勘対象を1人以上選択してください"),
});

function parseExpenseForm(formData: FormData) {
  return expenseSchema.safeParse({
    payerId: formData.get("payerId"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    rate: formData.get("rate") ?? "",
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

type ExpenseInput = z.infer<typeof expenseSchema>;

// 金額を立替の通貨の最小単位にし、外貨ならレートも検証する。
function parseAmountAndRate(
  data: ExpenseInput,
  baseCurrency: string,
): { amount: number; rate: string | null } {
  const amount = parseAmountToMinor(data.amount, data.currency);
  if (amount === null) throw new Error("金額が不正です");
  if (data.currency === baseCurrency) return { amount, rate: null };
  const rate = parseRate(data.rate);
  if (rate === null) throw new Error("為替レートが不正です");
  return { amount, rate };
}

async function upsertRate(
  db: ReturnType<typeof getDb>,
  groupId: string,
  currency: string,
  rate: string,
) {
  const updatedAt = new Date();
  await db
    .insert(schema.exchangeRates)
    .values({ groupId, currency, rate, updatedAt })
    .onConflictDoUpdate({
      target: [schema.exchangeRates.groupId, schema.exchangeRates.currency],
      set: { rate, updatedAt },
    });
}

export async function addExpense(groupId: string, formData: FormData) {
  const parsed = parseExpenseForm(formData);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "入力が不正です");
  }
  const { db, group } = await getGroupOrThrow(groupId);

  const { amount, rate } = parseAmountAndRate(parsed.data, group.currency);

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
  if (rate) await upsertRate(db, groupId, parsed.data.currency, rate);
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

  const { amount, rate } = parseAmountAndRate(parsed.data, group.currency);

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
  if (rate) await upsertRate(db, groupId, parsed.data.currency, rate);
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

// --- 為替レート ---

const rateSchema = z.object({
  currency: z.string().refine(isCurrencyCode, "対応していない通貨です"),
  rate: z.string().min(1, "レートを入力してください"),
});

export async function updateRate(groupId: string, formData: FormData) {
  const parsed = rateSchema.safeParse({
    currency: formData.get("currency"),
    rate: formData.get("rate"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "入力が不正です");
  }
  const { db, group } = await getGroupOrThrow(groupId);
  if (parsed.data.currency === group.currency) {
    throw new Error("精算通貨にはレートを設定できません");
  }
  const rate = parseRate(parsed.data.rate);
  if (rate === null) throw new Error("為替レートが不正です");
  await upsertRate(db, groupId, parsed.data.currency, rate);
  revalidatePath(`/g/${groupId}`);
}
