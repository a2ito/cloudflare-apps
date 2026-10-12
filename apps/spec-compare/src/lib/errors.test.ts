import { describe, expect, it } from "vitest";
import { errorChainMatches, errorMessages, isForeignKeyViolation, isUniqueViolation } from "./errors";

describe("errorMessages", () => {
	it("cause チェーンを順に辿る", () => {
		const root = new Error("root");
		const mid = new Error("mid", { cause: root });
		const top = new Error("top", { cause: mid });
		expect(errorMessages(top)).toEqual(["top", "mid", "root"]);
	});
	it("Error 以外は空", () => {
		expect(errorMessages("str")).toEqual([]);
		expect(errorMessages(null)).toEqual([]);
	});
	it("循環しても止まる", () => {
		const a = new Error("a");
		const b = new Error("b", { cause: a });
		a.cause = b;
		expect(errorMessages(a)).toEqual(["a", "b"]);
	});
});

describe("判定ヘルパ", () => {
	const wrapped = (msg: string) => new Error("Failed query: insert ...", { cause: new Error(`D1_ERROR: ${msg}: SQLITE_CONSTRAINT`) });

	it("ラップされた UNIQUE 違反を検出する", () => {
		expect(isUniqueViolation(wrapped("UNIQUE constraint failed: categories.name"))).toBe(true);
		expect(isUniqueViolation(new Error("other"))).toBe(false);
	});
	it("ラップされた FOREIGN KEY 違反を検出する", () => {
		expect(isForeignKeyViolation(wrapped("FOREIGN KEY constraint failed"))).toBe(true);
		expect(isForeignKeyViolation(wrapped("UNIQUE constraint failed: x"))).toBe(false);
	});
	it("任意パターンで照合できる", () => {
		expect(errorChainMatches(wrapped("no such table: foo"), /no such table/)).toBe(true);
	});
});
