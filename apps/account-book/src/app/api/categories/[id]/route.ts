import { NextResponse } from "next/server";
import { categories, expenses } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionUser } from "@/lib/session";

export async function DELETE(request: Request) {
  try {
    const userId = await getSessionUser(request);
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // 🔽 URL から id を取得
    const url = new URL(request.url);
    const id = url.pathname.split("/").pop();
    if (!id) {
      return NextResponse.json({ error: "invalid-id" }, { status: 400 });
    }

    const { env } = getCloudflareContext();
    const db = drizzle(env.DB);

    // 使用件数チェック
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(expenses)
      .where(eq(expenses.categoryId, id));

    if (count > 0) {
      return NextResponse.json({ error: "category-in-use" }, { status: 400 });
    }

    await db.delete(categories).where(eq(categories.id, Number(id)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete category error:", err);
    return NextResponse.json({ error: "server-error" }, { status: 500 });
  }
}
