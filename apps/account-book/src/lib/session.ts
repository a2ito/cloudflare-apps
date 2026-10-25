// セッション cookie は「ユーザID.有効期限.署名」。署名は HMAC-SHA256 で、
// 値を書き換えると検証に落ちる（以前はユーザID をそのまま入れていて、
// ID を知っていれば誰にでもなりすませた）。
//
// 鍵は GOOGLE_CLIENT_SECRET から導出する。専用の Secret を足すと、デプロイより先に
// Terraform で値を入れる順序が要るため。Client secret を作り直すと全員ログアウトになる。

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> | null => {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
};

const importKey = (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    encoder.encode(`account-book-session:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

/** ユーザID と有効期限（UNIX 秒）に署名した cookie の値を作る */
export const signSession = async (
  userId: string,
  secret: string,
  expiresAt: number,
): Promise<string> => {
  const payload = `${toBase64Url(encoder.encode(userId))}.${expiresAt}`;
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
};

/** 署名と有効期限を確かめ、正しければユーザID を返す */
export const verifySession = async (
  token: string,
  secret: string,
  now: number,
): Promise<string | null> => {
  const [encodedUserId, expiresAtText, encodedSignature, ...rest] =
    token.split(".");
  if (!encodedUserId || !expiresAtText || !encodedSignature || rest.length) {
    return null;
  }

  const expiresAt = Number(expiresAtText);
  if (!Number.isInteger(expiresAt) || expiresAt <= now) return null;

  const signature = fromBase64Url(encodedSignature);
  const userIdBytes = fromBase64Url(encodedUserId);
  if (!signature || !userIdBytes) return null;

  // verify は定数時間で比べる
  const key = await importKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(`${encodedUserId}.${expiresAtText}`),
  );
  return valid ? new TextDecoder().decode(userIdBytes) : null;
};

export const getSessionSecret = (): string => {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) {
    throw new Error(
      "GOOGLE_CLIENT_SECRET is not set (needed to sign sessions)",
    );
  }
  return secret;
};

const nowInSeconds = (): number => Math.floor(Date.now() / 1000);

/** ログイン直後に入れる cookie の値 */
export const createSessionToken = (userId: string): Promise<string> =>
  signSession(
    userId,
    getSessionSecret(),
    nowInSeconds() + SESSION_MAX_AGE_SECONDS,
  );

/** リクエストの cookie を検証し、ログイン中のユーザID を返す（無効なら null） */
export const getSessionUser = async (
  request: Request,
): Promise<string | null> => {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  if (!match) return null;
  return verifySession(match[1], getSessionSecret(), nowInSeconds());
};
