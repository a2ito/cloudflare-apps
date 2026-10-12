import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formData } from "@/test/d1";
import { idFromForm, optionalIdFromForm, optionalText, parseForm } from "./form";

describe("parseForm", () => {
	const schema = z.object({ name: z.string().min(1, "必須です"), id: idFromForm });

	it("FormData をスキーマで検証して返す", () => {
		const result = parseForm(schema, formData({ name: "豆乳", id: "3" }));
		expect(result).toEqual({ ok: true, data: { name: "豆乳", id: 3 } });
	});

	it("失敗時はフィールド名付きの先頭エラーを返す", () => {
		const result = parseForm(schema, formData({ name: "", id: "3" }));
		expect(result).toEqual({ ok: false, error: "name: 必須です" });
	});

	it("Next.js が付与する $ACTION_ 系フィールドは無視する", () => {
		const fd = formData({ name: "卵", id: "1" });
		fd.append("$ACTION_ID_abc", "x");
		const result = parseForm(z.object({ name: z.string(), id: idFromForm }).strict(), fd);
		expect(result.ok).toBe(true);
	});
});

describe("idFromForm", () => {
	it("正の整数だけ許可", () => {
		expect(idFromForm.safeParse("5").success).toBe(true);
		expect(idFromForm.safeParse("0").success).toBe(false);
		expect(idFromForm.safeParse("-1").success).toBe(false);
		expect(idFromForm.safeParse("1.5").success).toBe(false);
		expect(idFromForm.safeParse("abc").success).toBe(false);
	});
});

describe("optionalIdFromForm", () => {
	it("空文字は undefined（未分類）扱い", () => {
		expect(optionalIdFromForm.parse("")).toBeUndefined();
		expect(optionalIdFromForm.parse(undefined)).toBeUndefined();
	});
	it("数値文字列は number に変換", () => {
		expect(optionalIdFromForm.parse("7")).toBe(7);
	});
	it("不正値はエラー", () => {
		expect(optionalIdFromForm.safeParse("x").success).toBe(false);
	});
});

describe("optionalText", () => {
	it("空白のみは undefined、それ以外は trim", () => {
		expect(optionalText.parse("   ")).toBeUndefined();
		expect(optionalText.parse("")).toBeUndefined();
		expect(optionalText.parse("  メモ  ")).toBe("メモ");
	});
	it("500 文字を超えるとエラー", () => {
		expect(optionalText.safeParse("a".repeat(501)).success).toBe(false);
	});
});
