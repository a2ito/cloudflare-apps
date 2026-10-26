import { NextResponse } from "next/server";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
  createOAuthState,
} from "@/lib/oauth";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return new Response("OAuth env not set", { status: 500 });
  }

  const state = createOAuthState();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${process.env.ORIGIN}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
  });

  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  );
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });
  return res;
}
