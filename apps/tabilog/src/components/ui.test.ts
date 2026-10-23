import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ボタンは DOM を動かすテストを持てない（テストは node 環境で走る）ので、
 * 「押したあと反応が無いように見える」のを防ぐ約束だけソースで守る。
 */
const source = readFileSync(
  join(process.cwd(), "src/components/ui.tsx"),
  "utf8",
);
// ぐるぐる本体は、ui.tsx と link-pending.tsx の循環 import を避けるため別ファイルにある
const spinnerSource = readFileSync(
  join(process.cwd(), "src/components/spinner.tsx"),
  "utf8",
);

describe("処理中の表示", () => {
  it("ぐるぐるは回る（animate-spin を持つ）", () => {
    expect(spinnerSource).toMatch(/function Spinner[\s\S]*?animate-spin/);
  });

  it("ぐるぐるは読み上げから隠す（文字側が状態を伝える）", () => {
    expect(spinnerSource).toMatch(/function Spinner[\s\S]*?aria-hidden="true"/);
  });

  it("送信するボタンは処理中にぐるぐるを出す", () => {
    expect(source).toMatch(
      /function SubmitButton[\s\S]*?pending \? \([\s\S]*?<Spinner/,
    );
  });

  it("削除・サムネ変更のボタンも処理中にぐるぐるを出す", () => {
    for (const name of ["DangerButton", "QuietButton"]) {
      expect(source, `${name} にぐるぐるがありません`).toMatch(
        new RegExp(`function ${name}[\\s\\S]*?\\{pending && <Spinner`),
      );
    }
  });

  it("処理中のボタンは押せない（二重送信を防ぐ）", () => {
    const buttons =
      source.match(
        /function (SubmitButton|DangerButton|QuietButton)[\s\S]*?\n}\n/g,
      ) ?? [];
    expect(buttons).toHaveLength(3);
    for (const button of buttons)
      expect(button).toContain("disabled={pending}");
  });
});
