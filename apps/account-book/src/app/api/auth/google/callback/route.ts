import { BETTER_AUTH_GOOGLE_CALLBACK_PATH, getAuth } from "@/lib/auth";

/**
 * Google からの戻り。Google に登録してあるリダイレクト URI はこのパスなので、
 * クエリ（code / state）をそのまま付けて better-auth の callback に中継する。
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = BETTER_AUTH_GOOGLE_CALLBACK_PATH;
  return getAuth().handler(new Request(url, request));
}
