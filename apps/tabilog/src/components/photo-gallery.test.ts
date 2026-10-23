import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * このビューアは DOM を動かすテストを持てない（テストは node 環境で走る）ので、
 * 壊れると気づきにくい約束だけをソースで守る。
 */
const source = readFileSync(
  join(process.cwd(), "src/components/photo-gallery.tsx"),
  "utf8",
);

describe("写真のビューア", () => {
  it("Escape とフォーカスの扱いをブラウザに任せるため showModal で開く", () => {
    expect(source).toContain("showModal()");
    expect(source).toMatch(/<dialog/);
  });

  it("写真はボタンで開く（キーボードでも拡大できる）", () => {
    expect(source).toMatch(
      /<button[\s\S]*?onClick=\{\(\) => setOpenIndex\(index\)\}/,
    );
  });

  it("ダウンロードはファイル名を指定した download リンクで出す", () => {
    expect(source).toMatch(
      /<a href=\{open\.src\} download=\{open\.downloadName\}/,
    );
  });

  it("先頭以外の写真には「サムネにする」を出す", () => {
    expect(source).toContain("setCoverPhotoAction");
    expect(source).toMatch(/index === 0 \? \(/);
  });
});
