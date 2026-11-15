import { getAuth } from "@/lib/auth";

/**
 * Google のログイン画面へ送る。ログイン画面のリンク（<a href="/api/auth/google">）から開く。
 * better-auth が state の Cookie を発行するので、その Set-Cookie をリダイレクトに載せる。
 */
export async function GET(request: Request): Promise<Response> {
  const res = await getAuth().api.signInSocial({
    body: { provider: "google", callbackURL: "/", errorCallbackURL: "/login" },
    headers: request.headers,
    asResponse: true,
  });
  if (!res.ok) return res;

  const { url } = (await res.json()) as { url?: string };
  if (!url) {
    return new Response("Google のログイン URL を取得できませんでした", { status: 500 });
  }

  const headers = new Headers({ Location: url });
  for (const cookie of res.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}
