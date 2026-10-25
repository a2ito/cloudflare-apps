import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { userGroups } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/session";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/login")) {
    return;
  }

  // 未ログイン（セッションなし・署名が合わない・期限切れ）はログイン画面へ
  const userId = await getSessionUser(request);
  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { env } = getCloudflareContext();
  const db = drizzle(env.DB);
  const group = await db
    .select()
    .from(userGroups)
    .where(eq(userGroups.userId, userId))
    .get();

  // ログイン済みだがグループ未所属＝アクセス権なし
  if (!group) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }
}

export const config = {
  matcher: ["/", "/add/:path*", "/tags/:path*"],
};
