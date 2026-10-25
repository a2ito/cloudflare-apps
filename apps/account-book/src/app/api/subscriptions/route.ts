import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { categories, subscriptions } from "@/db/schema";
import { authorize } from "@/lib/apiAuth";
import { parseSubscriptionInput } from "@/lib/subscriptionInput";
import { postDueSubscriptionExpenses, todayInJst } from "@/lib/subscriptions";

/** 自グループのサブスク一覧をカテゴリ名つきで返す */
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;

  const { db, groupId } = auth;

  try {
    const result = await db
      .select({
        id: subscriptions.id,
        name: subscriptions.name,
        amount: subscriptions.amount,
        categoryId: subscriptions.categoryId,
        categoryName: categories.name,
        cycle: subscriptions.cycle,
        billingDay: subscriptions.billingDay,
        billingMonth: subscriptions.billingMonth,
        startDate: subscriptions.startDate,
        active: subscriptions.active,
      })
      .from(subscriptions)
      .leftJoin(categories, eq(subscriptions.categoryId, categories.id))
      .where(eq(subscriptions.groupId, groupId))
      .orderBy(asc(subscriptions.id));

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/subscriptions error:", err);
    return NextResponse.json({ error: "server-error" }, { status: 500 });
  }
}

/** サブスクを登録し、すでに請求日を過ぎている分はその場で計上する */
export async function POST(request: Request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;

  const { db, groupId } = auth;

  const input = parseSubscriptionInput(await request.json());
  if (!input.ok) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  try {
    const created = await db
      .insert(subscriptions)
      .values({ ...input.value, groupId })
      .returning({ id: subscriptions.id });

    await postDueSubscriptionExpenses(db, todayInJst(new Date()), groupId);

    return NextResponse.json(created[0], { status: 201 });
  } catch (err) {
    console.error("POST /api/subscriptions error:", err);
    return NextResponse.json({ error: "server-error" }, { status: 500 });
  }
}
