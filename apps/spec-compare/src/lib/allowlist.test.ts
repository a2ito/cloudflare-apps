import { describe, expect, it } from "vitest";
import { isSignInAllowed, parseAllowedEmails } from "./allowlist";

describe("parseAllowedEmails", () => {
	it("カンマ区切りを小文字・trim して Set にする", () => {
		const set = parseAllowedEmails(" Alice@Example.com, bob@example.com ,,");
		expect([...set]).toEqual(["alice@example.com", "bob@example.com"]);
	});
	it("未設定なら空", () => {
		expect(parseAllowedEmails(undefined).size).toBe(0);
		expect(parseAllowedEmails("").size).toBe(0);
		expect(parseAllowedEmails(null).size).toBe(0);
	});
});

describe("isSignInAllowed", () => {
	const allowed = parseAllowedEmails("me@example.com");

	it("許可リストのアドレスは通す（大文字小文字は無視）", () => {
		expect(isSignInAllowed({ email: "Me@Example.com", emailVerified: true }, allowed)).toBe(true);
	});
	it("email_verified が不明でも通す", () => {
		expect(isSignInAllowed({ email: "me@example.com" }, allowed)).toBe(true);
		expect(isSignInAllowed({ email: "me@example.com", emailVerified: null }, allowed)).toBe(true);
	});
	it("リスト外は拒否", () => {
		expect(isSignInAllowed({ email: "other@example.com", emailVerified: true }, allowed)).toBe(false);
	});
	it("メール未確認は拒否", () => {
		expect(isSignInAllowed({ email: "me@example.com", emailVerified: false }, allowed)).toBe(false);
	});
	it("メールが無ければ拒否", () => {
		expect(isSignInAllowed({ email: null }, allowed)).toBe(false);
		expect(isSignInAllowed({ email: "  " }, allowed)).toBe(false);
	});
	it("許可リストが空なら誰も入れない", () => {
		expect(isSignInAllowed({ email: "me@example.com", emailVerified: true }, new Set())).toBe(false);
	});
});
