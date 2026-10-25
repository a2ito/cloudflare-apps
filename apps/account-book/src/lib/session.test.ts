import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

const secret = "test-secret";
const now = 1_800_000_000;

describe("verifySession", () => {
  it("署名した値からユーザID を取り出せる", async () => {
    const token = await signSession("user-1", secret, now + 60);
    expect(await verifySession(token, secret, now)).toBe("user-1");
  });

  it("以前の形式（ユーザID をそのまま入れた値）は通さない", async () => {
    expect(await verifySession("user-1", secret, now)).toBeNull();
  });

  it("ユーザID を書き換えると通さない", async () => {
    const token = await signSession("user-1", secret, now + 60);
    const [, expiresAt, signature] = token.split(".");
    const forged = `${btoa("user-2").replace(/=+$/, "")}.${expiresAt}.${signature}`;
    expect(await verifySession(forged, secret, now)).toBeNull();
  });

  it("有効期限を延ばすと通さない", async () => {
    const token = await signSession("user-1", secret, now + 60);
    const [userId, , signature] = token.split(".");
    expect(
      await verifySession(`${userId}.${now + 9999}.${signature}`, secret, now),
    ).toBeNull();
  });

  it("期限切れは通さない", async () => {
    const token = await signSession("user-1", secret, now);
    expect(await verifySession(token, secret, now)).toBeNull();
  });

  it("別の鍵で署名した値は通さない", async () => {
    const token = await signSession("user-1", "other-secret", now + 60);
    expect(await verifySession(token, secret, now)).toBeNull();
  });

  it("壊れた値は例外にせず通さない", async () => {
    for (const token of ["", "a.b", "a.b.c.d", "!!!.1.!!!", "dXNlcg.x.abc"]) {
      expect(await verifySession(token, secret, now)).toBeNull();
    }
  });
});
