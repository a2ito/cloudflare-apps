import { NextResponse } from "next/server";
import { expenses, categories } from "@/db/schema";
import { sql, like, eq, and } from "drizzle-orm";
import { authorize } from "@/lib/apiAuth";

/** 自グループの、指定した年の月別・カテゴリ別の合計 */
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;

  const { db, groupId } = auth;

  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");

    if (!year) {
      return NextResponse.json({ monthly: [] });
    }

    const result = await db
      .select({
        month: sql<string>`substr(${expenses.date},1,7)`,
        category: categories.name,
        total: sql<number>`sum(${expenses.amount})`,
      })
      .from(expenses)
      .innerJoin(categories, eq(expenses.categoryId, categories.id))
      .where(
        and(like(expenses.date, `${year}%`), eq(expenses.groupId, groupId)),
      )
      .groupBy(sql`substr(${expenses.date},1,7)`, categories.name)
      .orderBy(sql`substr(${expenses.date},1,7)`);

    return NextResponse.json({ monthly: result ?? [] });
  } catch (err) {
    console.error("yearly error:", err);
    return NextResponse.json({ monthly: [] }, { status: 500 });
  }
}
