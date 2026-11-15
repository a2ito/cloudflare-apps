import { getAuth } from "@/lib/auth";

/** ログアウト。セッションの Cookie を消す */
export async function POST(request: Request): Promise<Response> {
  const res = await getAuth().api.signOut({ headers: request.headers, asResponse: true });
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const cookie of res.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
