import { describe, expect, it } from "vitest";
import {
  generateToken,
  hashToken,
  parseBearerToken,
  TOKEN_PREFIX,
} from "./token";

describe("generateToken", () => {
  it("接頭辞つきで、毎回ちがう値を返す", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(a).toMatch(/^wfm_[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});

describe("hashToken", () => {
  it("SHA-256 の 16 進を返し、同じ入力なら同じ値になる", async () => {
    const h = await hashToken("wfm_abc");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashToken("wfm_abc")).toBe(h);
    expect(await hashToken("wfm_abd")).not.toBe(h);
  });
});

describe("parseBearerToken", () => {
  it.each([
    ["Bearer wfm_abc", "wfm_abc"],
    ["bearer   wfm_abc", "wfm_abc"],
    ["Bearer abc", null],
    ["Basic wfm_abc", null],
    ["Bearer wfm_a wfm_b", null],
    ["", null],
    [null, null],
  ])("%j → %j", (header, expected) => {
    expect(parseBearerToken(header)).toBe(expected);
  });
});
