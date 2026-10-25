import { NextResponse } from "next/server";
import { expenses, categories } from "@/db/schema";
import { and, eq, like, sql } from "drizzle-orm";
import { authorize } from "@/lib/apiAuth";

/** 自グループの、指定した月のカテゴリ別の合計 */
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;

  const { db, groupId } = auth;

  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    if (!month) {
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
        and(like(expenses.date, `${month}%`), eq(expenses.groupId, groupId)),
      )
      .groupBy(categories.name);

    return NextResponse.json(result ?? []);
  } catch (err) {
    console.error("summary error:", err);
    return NextResponse.json([], { status: 500 });
  }
}
