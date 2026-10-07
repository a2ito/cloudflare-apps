import { describe, expect, it } from "vitest";
import { isSignInAllowed, parseAllowedEmails } from "./allowlist";

describe("parseAllowedEmails", () => {
  it("カンマ区切りを小文字にして空要素を落とす", () => {
    expect([...parseAllowedEmails(" A@example.com, ,b@example.com ")]).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("未設定なら空", () => {
    expect(parseAllowedEmails(undefined).size).toBe(0);
  });
});

describe("isSignInAllowed", () => {
  const allowed = parseAllowedEmails("a@example.com");

  it("許可リストにあれば通す（大文字小文字は区別しない）", () => {
    expect(
      isSignInAllowed({ email: "A@Example.com", emailVerified: true }, allowed),
    ).toBe(true);
  });

  it("許可リストに無ければ通さない", () => {
    expect(
      isSignInAllowed({ email: "b@example.com", emailVerified: true }, allowed),
    ).toBe(false);
  });

  it("メールが未確認なら通さない", () => {
    expect(
      isSignInAllowed(
        { email: "a@example.com", emailVerified: false },
        allowed,
      ),
    ).toBe(false);
  });

  it("メールが無ければ通さない", () => {
    expect(isSignInAllowed({ email: null }, allowed)).toBe(false);
  });
});
