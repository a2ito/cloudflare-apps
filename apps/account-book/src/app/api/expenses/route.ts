import { NextResponse } from "next/server";
//import { getDB } from '@/lib/db'
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { expenses, categories } from "@/db/schema";
import { eq, like, desc, and, inArray } from "drizzle-orm";
import { expenseTags } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { getUserGroupId } from "@/lib/getUserGroupId";
import {
  normalizeTagIds,
  replaceExpenseTags,
  findTagsByExpenseIds,
} from "@/lib/expenseTags";

type ExpenseSchema = {
  amount: number;
  categoryId: string;
  date: string;
  memo: string;
  tagIds?: unknown;
};

export async function GET(request: Request) {
  const userId = await getSessionUser(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { env } = getCloudflareContext();
  const db = drizzle(env.DB);

  const groupId = await getUserGroupId(db, userId);

  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    if (!month) {
      return NextResponse.json([], { status: 200 });
    }

    const conditions = [
      like(expenses.date, `${month}%`),
      eq(expenses.groupId, groupId),
    ];

    // tagId が指定されていればそのタグが付いた明細だけに絞り込む
    const tagId = Number(searchParams.get("tagId"));
    if (Number.isInteger(tagId) && tagId > 0) {
      conditions.push(
        inArray(
          expenses.id,
          db
            .select({ id: expenseTags.expenseId })
            .from(expenseTags)
            .where(eq(expenseTags.tagId, tagId)),
        ),
      );
    }

    const result = await db
      .select({
        id: expenses.id,
        amount: expenses.amount,
        date: expenses.date,
        memo: expenses.memo,
        categoryName: categories.name,
        categoryId: expenses.categoryId,
        receiptKey: expenses.receiptKey,
      })
      .from(expenses)
      .innerJoin(categories, eq(expenses.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(desc(expenses.date));

    const tagsByExpenseId = await findTagsByExpenseIds(
      db,
      result.map((row) => row.id),
    );

    // R2 のキーは画面に要らないので、付いているかどうかだけ返す
    const withTags = result.map(({ receiptKey, ...row }) => ({
      ...row,
      hasReceipt: receiptKey !== null,
      tags: tagsByExpenseId.get(row.id) ?? [],
    }));

    // 🔑 空でも必ず JSON を返す
    return NextResponse.json(withTags ?? []);
  } catch (err) {
    console.error("GET /api/expenses error:", err);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await getSessionUser(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { env } = getCloudflareContext();
  const db = drizzle(env.DB);
  const groupId = await getUserGroupId(db, userId);

  const { amount, categoryId, date, memo, tagIds } =
    (await request.json()) as ExpenseSchema;

  //const db = getDB()
  //const env = (request as any).env
  //const db = env.DB as D1Database
  //await db.prepare(
  //  `INSERT INTO expenses (amount, category_id, date, memo)
  //   VALUES (?, ?, ?, ?)`
  //).bind(amount, categoryId, date, memo).run()

  const created = await db
    .insert(expenses)
    .values({
      groupId,
      amount,
      categoryId,
      date,
      memo,
    })
    .returning({ id: expenses.id });

  const expenseId = created[0]?.id;
  if (expenseId) {
    await replaceExpenseTags(db, groupId, expenseId, normalizeTagIds(tagIds));
  }

  // レシートは作成後に /api/expenses/[id]/receipt へ送るので ID を返す
  return NextResponse.json({ ok: true, id: expenseId });
}
