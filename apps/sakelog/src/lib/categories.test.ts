import { describe, expect, it } from "vitest";
import {
  allowsField,
  CATEGORIES,
  CATEGORY_DEFS,
  categoryDef,
  categoryEmoji,
  categoryLabel,
  isCategory,
  SPECIFIC_FIELD_KEYS,
  SPECIFIC_FIELDS,
  termNote,
} from "./categories";

describe("お酒の種類", () => {
  it("定義と取りうる値が 1 対 1 で対応する（増やすときの取りこぼしを防ぐ）", () => {
    expect(CATEGORY_DEFS.map((c) => c.key)).toEqual([...CATEGORIES]);
  });

  it("既知の値だけを通す", () => {
    expect(isCategory("sake")).toBe(true);
    expect(isCategory("SAKE")).toBe(false);
    expect(isCategory("juice")).toBe(false);
  });

  it("未知の値でも画面を壊さない（その他の定義で受ける）", () => {
    expect(categoryLabel("whisky")).toBe("ウイスキー");
    expect(categoryLabel("juice")).toBe("juice");
    expect(categoryDef("juice").key).toBe("other");
    expect(categoryEmoji("juice")).toBe("🥂");
  });

  it("種類ごとに造り手と材料の呼び方を持つ（空にしない）", () => {
    for (const def of CATEGORY_DEFS) {
      expect(def.makerLabel, `${def.key} の makerLabel`).not.toBe("");
      expect(def.ingredientLabel, `${def.key} の ingredientLabel`).not.toBe("");
    }
  });

  it("ガイドに出す説明が空でない（候補を足したときの書き忘れを防ぐ）", () => {
    for (const def of CATEGORY_DEFS) {
      expect(def.description, `${def.key} の description`).not.toBe("");
      for (const term of [...def.ingredients, ...def.styles]) {
        expect(term.note, `${def.key} の ${term.name}`).not.toBe("");
      }
    }
  });

  it("同じ種類の中で候補の名前が重複しない", () => {
    for (const def of CATEGORY_DEFS) {
      for (const terms of [def.ingredients, def.styles]) {
        const names = terms.map((t) => t.name);
        expect(new Set(names).size, `${def.key} に重複した候補があります`).toBe(
          names.length,
        );
      }
    }
  });

  it("定義が参照する固有項目はすべて実在する", () => {
    for (const def of CATEGORY_DEFS) {
      for (const field of def.fields) {
        expect(SPECIFIC_FIELD_KEYS, `${def.key} の ${field}`).toContain(field);
      }
    }
  });

  it("すべての固有項目は、どこかの種類で使われている（孤児の列を作らない）", () => {
    const used = new Set(CATEGORY_DEFS.flatMap((c) => c.fields));
    for (const field of SPECIFIC_FIELD_KEYS) {
      expect([...used], `${field} を使う種類がありません`).toContain(field);
    }
  });
});

describe("allowsField", () => {
  it("その種類で意味を持つ項目だけを通す", () => {
    expect(allowsField("sake", "polishingRate")).toBe(true);
    expect(allowsField("beer", "polishingRate")).toBe(false);
    expect(allowsField("whisky", "agedYears")).toBe(true);
    expect(allowsField("wine", "ibu")).toBe(false);
  });
});

describe("固有項目の定義", () => {
  it("数値の項目は範囲を持つ（入力の取り違えを弾くため）", () => {
    for (const [key, def] of Object.entries(SPECIFIC_FIELDS)) {
      if (def.kind === "integer" || def.kind === "decimal") {
        expect(typeof def.min, `${key} の min`).toBe("number");
        expect(typeof def.max, `${key} の max`).toBe("number");
        expect(def.min, `${key} は min < max`).toBeLessThan(def.max);
      }
    }
  });
});

describe("termNote", () => {
  it("材料と分類のどちらからでも説明を引ける", () => {
    expect(termNote("wine", "メルロー")).toMatch(/まろやか/);
    expect(termNote("wine", "赤")).toMatch(/果皮/);
    expect(termNote("sake", "山田錦")).toMatch(/酒米/);
  });

  it("大文字小文字と前後の空白は無視する", () => {
    expect(termNote("beer", " IPA ")).not.toBeNull();
    expect(termNote("beer", "ipa")).not.toBeNull();
  });

  it("知らない名前は null（自由入力を許しているため）", () => {
    expect(termNote("wine", "謎の品種")).toBeNull();
    expect(termNote("juice", "メルロー")).toBeNull();
  });
});
