import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORY_DEFS, SPECIFIC_FIELD_KEYS } from "@/lib/categories";
import { RATING_AXES, ratingFieldName } from "@/lib/ratings";

/**
 * フォームは DOM を動かすテストを持てない（テストは node 環境で走る）ので、
 * サーバ側の受け口とずれると黙って値が落ちる箇所だけをソースで守る。
 */
const source = readFileSync(
  join(process.cwd(), "src/components/drink-form.tsx"),
  "utf8",
);
const action = readFileSync(
  join(process.cwd(), "src/app/actions/drinks.ts"),
  "utf8",
);

describe("記録のフォーム", () => {
  it("サーバ側が受け取る項目をすべて送る", () => {
    for (const name of [
      "name",
      "maker",
      "category",
      "style",
      "year",
      "abv",
      "ingredients",
      "country",
      "region",
      "price",
      "priceCurrency",
      "shop",
      "shopUrl",
      "drunkAt",
      "note",
    ]) {
      expect(source, `${name} の入力欄がありません`).toContain(
        `name="${name}"`,
      );
    }
  });

  it("評価はすべての軸を出す（軸を足したときの付け忘れを防ぐ）", () => {
    // 軸は一覧から組み立てているので、その組み立てが残っていることを見る
    expect(source).toContain("RATING_AXES.map");
    expect(source).toContain("ratingFieldName(axis.key)");
    for (const axis of RATING_AXES) {
      expect(action, `${axis.key} をアクションが受け取っていません`).toContain(
        `${ratingFieldName(axis.key)}:`,
      );
    }
  });

  it("種類と、種類ごとの入力欄は定義から組み立てる", () => {
    expect(source).toContain("CATEGORY_DEFS.map");
    // 固有項目は def.fields をたどって出す（種類を足しても直す場所が増えない）
    expect(source).toContain("def.fields.map");
    expect(source).toContain("<SpecificInput");
  });

  it("固有項目の name は DB の列と同じ（アクションがその名前で読む）", () => {
    // フォームは name={field} で送り、アクションは formData.get(key) で読む
    expect(source).toMatch(/name=\{field\}/);
    expect(action).toContain("formData.get(key)");
    for (const key of SPECIFIC_FIELD_KEYS) {
      expect(action, `${key} の扱いがありません`).toContain(
        "allowsField(category, key)",
      );
    }
  });

  it("種類を選び直すと入力欄が切り替わる（状態として持つ）", () => {
    expect(source).toMatch(/useState<Category>/);
    expect(source).toContain("setCategory(e.target.value as Category)");
  });

  it("候補は種類ごとの定義から出す", () => {
    expect(source).toContain("def.ingredients.map");
    expect(source).toContain("def.styles.map");
    // 定義が空でない種類が実際にある（このテスト自体の前提）
    expect(
      CATEGORY_DEFS.filter((c) => c.ingredients.length > 0).length,
    ).toBeGreaterThan(3);
  });

  it("編集のときは id を隠し項目で送る（新しい行を作らない）", () => {
    expect(source).toMatch(/name="id" value=\{drink\.id\}/);
  });

  it("写真は縮小してから送る入力欄を使う", () => {
    expect(source).toContain('<PhotoInput name="photos" />');
  });
});
