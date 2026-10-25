import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { expenses, subscriptions } from "@/db/schema";
import { authorize } from "@/lib/apiAuth";
import { parseSubscriptionInput } from "@/lib/subscriptionInput";
import { postDueSubscriptionExpenses, todayInJst } from "@/lib/subscriptions";

const parseId = async (params: Promise<{ id: string }>) => {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** サブスクの内容を更新する。計上済みの支出は書き換えない */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;

  const { db, groupId } = auth;

  const id = await parseId(params);
  if (id === null) {
    return NextResponse.json({ error: "invalid-id" }, { status: 400 });
  }

  const input = parseSubscriptionInput(await request.json());
  if (!input.ok) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  try {
    const updated = await db
      .update(subscriptions)
      .set(input.value)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.groupId, groupId)))
      .returning({ id: subscriptions.id });

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "subscription-not-found" },
        { status: 404 },
      );
    }

    // 再開したときや開始日を前にずらしたときの取りこぼしを埋める
    await postDueSubscriptionExpenses(db, todayInJst(new Date()), groupId);

    return NextResponse.json(updated[0]);
  } catch (err) {
    console.error("PATCH /api/subscriptions/[id] error:", err);
    return NextResponse.json({ error: "server-error" }, { status: 500 });
  }
}

/** サブスクを削除する。計上済みの支出は残し、紐付けだけ外す */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;

  const { db, groupId } = auth;

  const id = await parseId(params);
  if (id === null) {
    return NextResponse.json({ error: "invalid-id" }, { status: 400 });
  }

  try {
    // 他グループのサブスクを削除できないよう所有を確認する
    const target = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.groupId, groupId)))
      .get();

    if (!target) {
      return NextResponse.json(
        { error: "subscription-not-found" },
        { status: 404 },
      );
    }

    await db
      .update(expenses)
      .set({ subscriptionId: null })
      .where(eq(expenses.subscriptionId, id));
    await db.delete(subscriptions).where(eq(subscriptions.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/subscriptions/[id] error:", err);
    return NextResponse.json({ error: "server-error" }, { status: 500 });
  }
}
