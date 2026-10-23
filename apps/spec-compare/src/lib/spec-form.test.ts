import { describe, expect, it } from "vitest";
import { formData } from "@/test/d1";
import { parseSpecValues, specDefaultValue } from "./spec-form";

const FIELDS = [
  { id: 1, name: "CPU", kind: "text" as const },
  { id: 2, name: "メモリ", kind: "number" as const },
  { id: 3, name: "タッチ", kind: "bool" as const },
];

describe("parseSpecValues", () => {
  it("型ごとに値を取り出し、空欄は行を作らない", () => {
    const result = parseSpecValues(
      FIELDS,
      formData({ spec_1: " M4 ", spec_2: "16", spec_3: "" }),
    );
    expect(result).toEqual({
      ok: true,
      values: [
        { fieldId: 1, valueNum: null, valueText: "M4" },
        { fieldId: 2, valueNum: 16, valueText: null },
      ],
    });
  });

  it("0 は未入力ではなく値として残す", () => {
    const result = parseSpecValues(
      FIELDS,
      formData({ spec_2: "0", spec_3: "no" }),
    );
    expect(result).toEqual({
      ok: true,
      values: [
        { fieldId: 2, valueNum: 0, valueText: null },
        { fieldId: 3, valueNum: 0, valueText: null },
      ],
    });
  });

  it("貼り付けた桁区切りと全角数字を数値にする", () => {
    const result = parseSpecValues(
      FIELDS,
      formData({ spec_2: "１，０２４．５" }),
    );
    expect(result).toEqual({
      ok: true,
      values: [{ fieldId: 2, valueNum: 1024.5, valueText: null }],
    });
  });

  it("数値でなければ項目名つきのエラー", () => {
    expect(parseSpecValues(FIELDS, formData({ spec_2: "16GB" }))).toEqual({
      ok: false,
      error: "「メモリ」は数値で入力してください",
    });
  });

  it("bool は決まった値しか受け付けない", () => {
    expect(parseSpecValues(FIELDS, formData({ spec_3: "maybe" })).ok).toBe(
      false,
    );
  });

  it("長すぎるテキストは弾く", () => {
    expect(
      parseSpecValues(FIELDS, formData({ spec_1: "a".repeat(101) })).ok,
    ).toBe(false);
  });

  it("カテゴリに無い項目の値は拾わない", () => {
    expect(parseSpecValues(FIELDS, formData({ spec_99: "1" }))).toEqual({
      ok: true,
      values: [],
    });
  });
});

describe("specDefaultValue", () => {
  it("parseSpecValues の入力に戻す", () => {
    expect(specDefaultValue("number", { num: 16, text: null })).toBe("16");
    expect(specDefaultValue("bool", { num: 1, text: null })).toBe("yes");
    expect(specDefaultValue("bool", { num: 0, text: null })).toBe("no");
    expect(specDefaultValue("text", { num: null, text: "M4" })).toBe("M4");
    expect(specDefaultValue("number", undefined)).toBe("");
  });
});
