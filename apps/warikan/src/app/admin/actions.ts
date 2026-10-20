"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireAdmin, signIn, signOut } from "@/lib/auth";

export async function signInAdmin() {
  await signIn("google", { redirectTo: "/admin" });
}

export async function signOutAdmin() {
  await signOut({ redirectTo: "/admin/login" });
}

// Server Action は URL さえ分かれば外から直接呼べるので、ページとは別にここでも管理者か確かめる
export async function deleteGroup(groupId: string) {
  await requireAdmin();
  const db = getDb();

  const group = await db.query.groups.findFirst({
    where: eq(schema.groups.id, groupId),
  });
  if (!group) throw new Error("グループが見つかりません");

  // expense_participants と expenses は members を restrict で参照しているので、
  // 参照する側から順に消す。batch は 1 つのトランザクションで流れ、途中で失敗しても半端に残らない
  const expenseIds = db
    .select({ id: schema.expenses.id })
    .from(schema.expenses)
    .where(eq(schema.expenses.groupId, groupId));
  await db.batch([
    db
      .delete(schema.expenseParticipants)
      .where(inArray(schema.expenseParticipants.expenseId, expenseIds)),
    db.delete(schema.expenses).where(eq(schema.expenses.groupId, groupId)),
    db
      .delete(schema.exchangeRates)
      .where(eq(schema.exchangeRates.groupId, groupId)),
    db.delete(schema.members).where(eq(schema.members.groupId, groupId)),
    db.delete(schema.groups).where(eq(schema.groups.id, groupId)),
  ]);

  revalidatePath("/admin");
  revalidatePath(`/g/${groupId}`);
  redirect("/admin");
}
