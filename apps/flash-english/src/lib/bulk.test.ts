import { describe, expect, it } from "vitest";
import { parseBulk } from "./bulk";

describe("parseBulk", () => {
	it("1 行に日本文と英文をタブ区切りで読む。空行と前後の空白は無視する", () => {
		expect(parseBulk("私は学生です。\tI am a student.\n\n  これはペンです。 \t This is a pen. \r\n")).toEqual({
			ok: true,
			pairs: [
				{ ja: "私は学生です。", en: "I am a student." },
				{ ja: "これはペンです。", en: "This is a pen." },
			],
		});
	});

	it("英文にタブが入っていても、最初のタブで分ける", () => {
		expect(parseBulk("あ\tA\tB")).toEqual({ ok: true, pairs: [{ ja: "あ", en: "A\tB" }] });
	});

	it.each([
		["あ\tA\nいい", "2 行目: 日本文と英文をタブで区切ってください"],
		["\tA", "1 行目: 日本文と英文の両方を入れてください"],
		["あ\t ", "1 行目: 日本文と英文の両方を入れてください"],
		[`${"あ".repeat(501)}\tA`, "1 行目: 1 文は 500 文字までです"],
		["\n  \n", "登録する文がありません"],
		[Array.from({ length: 501 }, () => "あ\tA").join("\n"), "一度に登録できるのは 500 行までです"],
	])("崩れた入力は何も登録しない（%#）", (text, error) => {
		expect(parseBulk(text)).toEqual({ ok: false, error });
	});
});
