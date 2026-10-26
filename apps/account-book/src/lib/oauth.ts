// Google ログイン（OAuth 2.0 / OIDC）の検証まわり。
//
// state: ログイン開始時に乱数を cookie と認可 URL の両方に入れ、callback で一致を確かめる。
// 無いと、攻撃者が自分のアカウントの code を踏ませて、相手を攻撃者のアカウントで
// ログインさせられる（login CSRF）。

export const OAUTH_STATE_COOKIE = "oauth_state";
export const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10;

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const createOAuthState = (): string =>
  toBase64Url(crypto.getRandomValues(new Uint8Array(32)));

/** cookie の state と callback に戻ってきた state が一致するか */
export const isValidOAuthState = (
  expected: string | null | undefined,
  actual: string | null | undefined,
): boolean => !!expected && !!actual && expected === actual;

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

const decodeJwtPayload = (jwt: string): Record<string, unknown> | null => {
  const part = jwt.split(".")[1];
  if (!part) return null;
  try {
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(part.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
        c.charCodeAt(0),
      ),
    );
    const payload: unknown = JSON.parse(json);
    return typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

/**
 * トークンエンドポイントから直接受け取った id_token からメールアドレスを取り出す。
 * TLS で Google から直接受け取るので署名は確かめない（OIDC Core 3.1.3.7）が、
 * 発行者・宛先（自分の client_id）・有効期限・メール確認済みは確かめる。
 * 通らなければ null。
 */
export const getVerifiedEmail = (
  idToken: string,
  clientId: string,
  now: number,
): string | null => {
  const payload = decodeJwtPayload(idToken);
  if (!payload) return null;

  const { iss, aud, exp, email, email_verified } = payload;
  if (typeof iss !== "string" || !GOOGLE_ISSUERS.includes(iss)) return null;
  if (aud !== clientId) return null;
  if (typeof exp !== "number" || exp <= now) return null;
  if (typeof email !== "string" || !email) return null;
  // Google は確認済みでないメールも email に入れてくるので、確認済みだけ通す
  if (email_verified !== true) return null;
  return email;
};
