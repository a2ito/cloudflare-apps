import { NextResponse } from "next/server";
import { expenses, categories } from "@/db/schema";
import { and, eq, like, sql } from "drizzle-orm";
import { authorize } from "@/lib/apiAuth";

/** 自グループの、指定した年のカテゴリ別の合計 */
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;

  const { db, groupId } = auth;

  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");

    if (!year) {
      return NextResponse.json([]);
    }

    const result = await db
      .select({
        category: categories.name,
        total: sql<number>`sum(${expenses.amount})`,
      })
      .from(expenses)
      .innerJoin(categories, eq(expenses.categoryId, categories.id))
      .where(
        and(like(expenses.date, `${year}%`), eq(expenses.groupId, groupId)),
      )
      .groupBy(categories.name);

    return NextResponse.json(result ?? []);
  } catch (err) {
    console.error("yearly categories error:", err);
    return NextResponse.json([], { status: 500 });
  }
}
