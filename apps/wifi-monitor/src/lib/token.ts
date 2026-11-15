/**
 * 端末のトークン。エージェントが受信 API に送る。
 *
 * 32 バイトの乱数なので総当たりは現実的でなく、比べるのはハッシュ同士で済む
 * （パスワードと違い低エントロピーではないため、bcrypt のような遅いハッシュは要らない）。
 */

/** 見ただけで何のトークンか分かるようにする（ログや設定ファイルに紛れたときのため） */
export const TOKEN_PREFIX = "wfm_";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return TOKEN_PREFIX + toBase64Url(bytes);
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Authorization ヘッダからトークンを取り出す。形が違えば null */
export function parseBearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? "");
  const token = match?.[1];
  return token && token.startsWith(TOKEN_PREFIX) ? token : null;
}
