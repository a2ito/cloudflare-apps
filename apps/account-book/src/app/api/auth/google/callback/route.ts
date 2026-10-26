import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
} from "@/lib/session";
import {
  OAUTH_STATE_COOKIE,
  getVerifiedEmail,
  isValidOAuthState,
} from "@/lib/oauth";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token: string;
};

// state は 1 回きり。成功でも失敗でも消す
const clearOAuthState = (res: NextResponse): NextResponse => {
  res.cookies.set(OAUTH_STATE_COOKIE, "", {
    path: "/api/auth/google",
    maxAge: 0,
  });
  return res;
};

const loginError = (request: Request, error: string): NextResponse =>
  clearOAuthState(
    NextResponse.redirect(new URL(`/login?error=${error}`, request.url)),
  );

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  // ログインを始めたブラウザ自身からの戻りか（login CSRF 対策）
  if (
    !code ||
    !isValidOAuthState(
      request.cookies.get(OAUTH_STATE_COOKIE)?.value,
      searchParams.get("state"),
    )
  ) {
    return loginError(request, "oauth");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response("OAuth env not set", { status: 500 });
  }

  // ① トークン取得
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${process.env.ORIGIN}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return loginError(request, "token");
  }
  const token = (await tokenRes.json()) as GoogleTokenResponse;

  // ② id_token を検証（発行者・宛先・期限・メール確認済み）
  const email = getVerifiedEmail(
    token.id_token,
    clientId,
    Math.floor(Date.now() / 1000),
  );
  if (!email) {
    return loginError(request, "token");
  }

  // ③ 事前登録ユーザか確認
  const { env } = getCloudflareContext();
  const db = drizzle(env.DB);

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!user) {
    return loginError(request, "not-allowed");
  }

  // ④ セッションCookie発行
  const res = NextResponse.redirect(new URL("/", request.url));
  res.cookies.set(SESSION_COOKIE, await createSessionToken(user.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return clearOAuthState(res);
}
