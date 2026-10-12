import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots.txt", () => {
	it("すべてのクローラにすべてのパスをたどらせない（ログインが要るため）", () => {
		const rules = robots().rules;
		expect(Array.isArray(rules)).toBe(false);
		expect(rules).toMatchObject({ userAgent: "*", disallow: "/" });
	});

	it("許可（allow）は書かない（書くと disallow より優先されることがある）", () => {
		expect(robots().rules).not.toHaveProperty("allow");
	});
});
