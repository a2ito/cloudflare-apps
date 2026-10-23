import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inputClass } from "./ui";

/**
 * inputClass には w-full が入っている。同じ要素に w-32 のような幅指定を重ねても
 * どちらが効くかは Tailwind が出力する順序次第で、実際に金額欄が潰れる不具合が出た。
 * 幅は入れ物側で指定する、という約束をテストで守る。
 */
const source = readFileSync(
  join(process.cwd(), "src/components/entry-form.tsx"),
  "utf8",
);

describe("金額欄のレイアウト", () => {
  it("inputClass は w-full を含む（このテストの前提）", () => {
    expect(inputClass).toContain("w-full");
  });

  it("inputClass と固定幅クラスを同じ要素に重ねていない", () => {
    // className={`${inputClass} ... w-24 ...`} のような書き方を禁じる（min-w / max-w は別物なので除く）
    const conflicts = source.match(
      /\$\{inputClass\}[^`]*(?<![\w-])w-(?!full\b)[\w./[\]]+/g,
    );
    expect(
      conflicts,
      `幅は外側の要素で指定してください: ${conflicts?.join(", ")}`,
    ).toBeNull();
  });

  it("金額の入力欄は残りの幅いっぱいに広がる", () => {
    expect(source).toMatch(
      /name="amount"[\s\S]*?className=\{`\$\{inputClass\} min-w-0 flex-1`\}/,
    );
  });
});
