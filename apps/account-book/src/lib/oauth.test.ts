import { describe, expect, it } from "vitest";
import { createOAuthState, getVerifiedEmail, isValidOAuthState } from "./oauth";

const clientId = "client-1.apps.googleusercontent.com";
const now = 1_800_000_000;

const toBase64Url = (value: string): string =>
  btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const idToken = (claims: Record<string, unknown>): string =>
  `${toBase64Url('{"alg":"RS256"}')}.${toBase64Url(JSON.stringify(claims))}.sig`;

const valid = {
  iss: "https://accounts.google.com",
  aud: clientId,
  exp: now + 60,
  email: "user@example.com",
  email_verified: true,
};

describe("getVerifiedEmail", () => {
  it("正しい id_token からメールアドレスを取り出せる", () => {
    expect(getVerifiedEmail(idToken(valid), clientId, now)).toBe(
      "user@example.com",
    );
  });

  it("メールが確認済みでなければ通さない", () => {
    expect(
      getVerifiedEmail(
        idToken({ ...valid, email_verified: false }),
        clientId,
        now,
      ),
    ).toBeNull();
    // JSON にすると undefined のキーは消える＝クレーム自体が無い
    expect(
      getVerifiedEmail(
        idToken({ ...valid, email_verified: undefined }),
        clientId,
        now,
      ),
    ).toBeNull();
  });

  it("別のクライアント宛ての id_token は通さない", () => {
    expect(
      getVerifiedEmail(idToken({ ...valid, aud: "other" }), clientId, now),
    ).toBeNull();
  });

  it("Google 以外の発行者は通さない", () => {
    expect(
      getVerifiedEmail(
        idToken({ ...valid, iss: "https://evil.example" }),
        clientId,
        now,
      ),
    ).toBeNull();
  });

  it("期限切れは通さない", () => {
    expect(
      getVerifiedEmail(idToken({ ...valid, exp: now }), clientId, now),
    ).toBeNull();
  });

  it("壊れた値は通さない", () => {
    expect(getVerifiedEmail("", clientId, now)).toBeNull();
    expect(getVerifiedEmail("a.!!!.b", clientId, now)).toBeNull();
    expect(
      getVerifiedEmail(`a.${toBase64Url("null")}.b`, clientId, now),
    ).toBeNull();
  });
});

describe("isValidOAuthState", () => {
  it("一致すれば通す", () => {
    const state = createOAuthState();
    expect(isValidOAuthState(state, state)).toBe(true);
  });

  it("不一致・片方なしは通さない", () => {
    expect(isValidOAuthState("a", "b")).toBe(false);
    expect(isValidOAuthState(undefined, "a")).toBe(false);
    expect(isValidOAuthState("a", null)).toBe(false);
    expect(isValidOAuthState("", "")).toBe(false);
  });

  it("毎回違う値を作る", () => {
    expect(createOAuthState()).not.toBe(createOAuthState());
  });
});
