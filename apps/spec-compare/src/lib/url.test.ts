import { describe, expect, it } from "vitest";
import { isSafeExternalUrl, linkHostname } from "./url";

describe("isSafeExternalUrl", () => {
	it("http と https は許可する", () => {
		expect(isSafeExternalUrl("https://example.com/item/1")).toBe(true);
		expect(isSafeExternalUrl("http://example.com")).toBe(true);
	});

	it.each([
		["javascript:alert(1)"],
		["data:text/html,<script>alert(1)</script>"],
		["vbscript:msgbox(1)"],
		["file:///etc/passwd"],
		["ftp://example.com"],
	])("危険または想定外の形式を弾く: %s", (value) => {
		expect(isSafeExternalUrl(value)).toBe(false);
	});

	it("大文字小文字を問わず javascript を弾く", () => {
		expect(isSafeExternalUrl("JaVaScRiPt:alert(1)")).toBe(false);
	});

	it("URL として解釈できない値は false", () => {
		expect(isSafeExternalUrl("example.com")).toBe(false);
		expect(isSafeExternalUrl("   ")).toBe(false);
		expect(isSafeExternalUrl("")).toBe(false);
		expect(isSafeExternalUrl(null)).toBe(false);
		expect(isSafeExternalUrl(undefined)).toBe(false);
	});
});

describe("linkHostname", () => {
	it("ホスト名を返し、www は落とす", () => {
		expect(linkHostname("https://www.amazon.co.jp/dp/XXXX")).toBe("amazon.co.jp");
		expect(linkHostname("https://shop.example.com/a")).toBe("shop.example.com");
	});
	it("安全でない URL は null", () => {
		expect(linkHostname("javascript:alert(1)")).toBeNull();
		expect(linkHostname(null)).toBeNull();
	});
});
