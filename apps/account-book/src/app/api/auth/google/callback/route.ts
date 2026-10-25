import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
} from "@/lib/session";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect("/login?error=oauth");
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

  const token = (await tokenRes.json()) as GoogleTokenResponse;
  const idToken = token.id_token;

  // ② id_token を検証
  const payload = JSON.parse(atob(idToken.split(".")[1]));

  const email = payload.email;

  // ③ 事前登録ユーザか確認
  const { env } = getCloudflareContext();
  const db = drizzle(env.DB);

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!user) {
    //return NextResponse.redirect("/login?error=not-allowed");
    return NextResponse.redirect(
      new URL("/login?error=not-allowed", request.url),
    );
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

  return res;
}
