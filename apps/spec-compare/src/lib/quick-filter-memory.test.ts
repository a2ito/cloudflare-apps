import { describe, expect, it } from "vitest";
import { parseSavedQuickParams, pickQuickParams, withQuickParams } from "./quick-filter-memory";

describe("pickQuickParams", () => {
	it("簡易フィルタの項目の条件だけを、複数選択も含めて抜き出す", () => {
		const search = new URLSearchParams("sort=f2&in_16=Windows&in_16=macOS&min_2=32&max_9=1&q_16=win&fav=1&in_4=");
		expect(pickQuickParams(search, [16, 2])).toEqual([
			["in_16", "Windows"],
			["in_16", "macOS"],
			["min_2", "32"],
		]);
	});
});

describe("parseSavedQuickParams", () => {
	it("壊れた値や形の違う値は空にする", () => {
		expect(parseSavedQuickParams(null)).toEqual([]);
		expect(parseSavedQuickParams("{")).toEqual([]);
		expect(parseSavedQuickParams('{"a":1}')).toEqual([]);
		expect(parseSavedQuickParams('[["in_1","a"],["x"],[1,2]]')).toEqual([["in_1", "a"]]);
	});
});

describe("withQuickParams", () => {
	it("今の条件を残して足す", () => {
		expect(withQuickParams(new URLSearchParams("sort=name"), [["in_1", "a"], ["in_1", "b"]])).toBe("sort=name&in_1=a&in_1=b");
	});
});
