import { describe, expect, it, vi } from "vitest";
import { resolveSignInUid } from "./signIn";

describe("resolveSignInUid", () => {
  it("確認済みで事前登録されていれば users.id を返す", async () => {
    const find = vi.fn(async () => "user-1");
    expect(
      await resolveSignInUid(
        { email: "a@example.com", emailVerified: true },
        find,
      ),
    ).toBe("user-1");
    expect(find).toHaveBeenCalledWith("a@example.com");
  });

  it("事前登録されていなければ通さない", async () => {
    expect(
      await resolveSignInUid(
        { email: "a@example.com", emailVerified: true },
        async () => null,
      ),
    ).toBeNull();
  });

  it("メールが確認済みでなければ、登録があっても通さず照合もしない", async () => {
    const find = vi.fn(async () => "user-1");
    expect(
      await resolveSignInUid(
        { email: "a@example.com", emailVerified: false },
        find,
      ),
    ).toBeNull();
    expect(find).not.toHaveBeenCalled();
  });

  it("メールは小文字にして前後の空白を除いてから照合する", async () => {
    const find = vi.fn(async () => "user-1");
    await resolveSignInUid(
      { email: " A@Example.COM ", emailVerified: true },
      find,
    );
    expect(find).toHaveBeenCalledWith("a@example.com");
  });

  it("空のメールは通さない", async () => {
    const find = vi.fn(async () => "user-1");
    expect(
      await resolveSignInUid({ email: "  ", emailVerified: true }, find),
    ).toBeNull();
    expect(find).not.toHaveBeenCalled();
  });
});
