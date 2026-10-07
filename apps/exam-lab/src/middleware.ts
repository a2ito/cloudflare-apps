import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth.js のセッション Cookie。HTTPS では __Secure- が付く
const SESSION_COOKIES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
];

/**
 * 未ログインならログイン画面（/）へ送るだけ。Cookie の中身は検証しない。
 * データは全て API から取り、API 側（requireApiUser）でセッションを検証するので、
 * ここを通り抜けても見られるのは空の画面だけ。
 */
export function middleware(req: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (!hasSession) {
    return NextResponse.redirect(new URL("/", req.url));
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/questions/:path*",
    "/exams/:path*",
    "/categories/:path*",
  ],
};
