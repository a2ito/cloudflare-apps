import { NextResponse } from "next/server";
import { expenses, expenseTags } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/session";
import { getUserGroupId } from "@/lib/getUserGroupId";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { normalizeTagIds, replaceExpenseTags } from "@/lib/expenseTags";

type UpdateExpenseBody = {
  amount: number;
  categoryId: string | null;
  date: string;
  memo?: string | null;
  tagIds?: unknown;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = (await params).id;
  const userId = await getSessionUser(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { env } = getCloudflareContext();
  const db = drizzle(env.DB);

  const groupId = await getUserGroupId(db, userId);
  const expenseId = Number(id);

  const body = (await request.json()) as UpdateExpenseBody;
  const { amount, categoryId, date, memo, tagIds } = body;

  const updated = await db
    .update(expenses)
    .set({
      amount,
      categoryId: categoryId ? categoryId : null,
      date,
      memo: memo || null,
    })
    .where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)))
    .returning({ id: expenses.id });

  if (updated.length === 0) {
    return NextResponse.json({ error: "expense-not-found" }, { status: 404 });
  }

  // tagIds が渡されたときだけタグを置き換える（未指定なら現状維持）
  if (tagIds !== undefined) {
    await replaceExpenseTags(db, groupId, expenseId, normalizeTagIds(tagIds));
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = (await params).id;
  const userId = await getSessionUser(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { env } = getCloudflareContext();
  const db = drizzle(env.DB);

  const groupId = await getUserGroupId(db, userId);
  const expenseId = Number(id);

  // 他グループの明細を削除できないよう所有を確認する
  const target = await db
    .select({ id: expenses.id, receiptKey: expenses.receiptKey })
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)))
    .get();

  if (!target) {
    return NextResponse.json({ ok: true });
  }

  // expense_tags が expenses を参照しているため紐付けを先に外す
  await db.delete(expenseTags).where(eq(expenseTags.expenseId, expenseId));
  await db.delete(expenses).where(eq(expenses.id, expenseId));

  if (target.receiptKey) {
    await env.RECEIPTS_BUCKET.delete(target.receiptKey);
  }

  return NextResponse.json({ ok: true });
}
