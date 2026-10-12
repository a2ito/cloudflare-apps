import { describe, expect, it } from "vitest";
import { formatDay, isDate, shiftDate, today } from "./date";

describe("isDate", () => {
	it("YYYY-MM-DD の実在する日付だけ通す", () => {
		expect(isDate("2026-09-25")).toBe(true);
		expect(isDate("2028-02-29")).toBe(true);
	});
	it("存在しない日付や形の違うものは弾く", () => {
		expect(isDate("2026-02-30")).toBe(false);
		expect(isDate("2026-13-01")).toBe(false);
		expect(isDate("2026-9-25")).toBe(false);
		expect(isDate("")).toBe(false);
	});
});

describe("today", () => {
	it("UTC ではなく日本時間の日付を返す", () => {
		// UTC では 9/24 の 15:30、日本時間では 9/25 の 0:30
		expect(today(new Date("2026-09-24T15:30:00Z"))).toBe("2026-09-25");
	});
});

describe("shiftDate", () => {
	it("月末・年末・うるう年をまたげる", () => {
		expect(shiftDate("2026-09-30", 1)).toBe("2026-10-01");
		expect(shiftDate("2027-01-01", -1)).toBe("2026-12-31");
		expect(shiftDate("2028-02-28", 1)).toBe("2028-02-29");
	});
});

describe("formatDay", () => {
	it("月/日（曜日）にする", () => {
		expect(formatDay("2026-09-25")).toBe("9/25（金）");
	});
});
