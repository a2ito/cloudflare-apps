import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 原因の分からない 404 や無反応が報告されたとき、手がかりが何も残らなかった。
 * 失敗したときに「何が起きたか」を画面に出す約束をソースで守る。
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("見つからないときの画面", () => {
  const source = read("src/app/not-found.tsx");

  it("素の Next.js の 404 と見分けが付く（アプリの言葉で説明する）", () => {
    expect(source).toContain("見つかりませんでした");
    expect(source).toMatch(/削除|古い/);
  });

  it("戻る手段を出す", () => {
    expect(source).toContain('href="/"');
  });
});

describe("表示に失敗したときの画面", () => {
  const source = read("src/app/error.tsx");

  it("クライアントコンポーネントである（エラー境界の決まり）", () => {
    expect(source.startsWith('"use client"')).toBe(true);
  });

  it("この版の Next.js の retry を受け取る", () => {
    expect(source).toMatch(/retry\s*\}:/);
    expect(source).toContain("retry()");
  });

  it("報告に使える手がかりを出す（内容・識別子・時刻）", () => {
    expect(source).toContain("error.message");
    expect(source).toContain("error.digest");
    expect(source).toContain("toLocaleString");
  });

  it("やり直しと再読み込みの両方を出す", () => {
    expect(source).toContain("window.location.reload()");
  });
});

describe("いちばん外側が壊れたときの画面", () => {
  it("global-error があり、自前の html と body を持つ", () => {
    expect(existsSync(join(process.cwd(), "src/app/global-error.tsx"))).toBe(
      true,
    );
    const source = read("src/app/global-error.tsx");
    expect(source).toContain("<html");
    expect(source).toContain("<body");
  });
});

describe("画面に出すエラーの知らせ", () => {
  const source = read("src/components/error-banner.tsx");

  it("JavaScript のエラーと、拾われなかった失敗の両方を捕まえる", () => {
    expect(source).toContain('addEventListener("error"');
    expect(source).toContain('addEventListener("unhandledrejection"');
  });

  it("画像の読み込み失敗のような雑音は拾わない", () => {
    expect(source).toMatch(/if \(!event\.error && !event\.message\) return;/);
  });

  it("離れるときに後始末する", () => {
    expect(source).toContain('removeEventListener("error"');
    expect(source).toContain('removeEventListener("unhandledrejection"');
  });

  it("レイアウトに置かれている（どの画面でも出る）", () => {
    expect(read("src/app/layout.tsx")).toContain("<ErrorBanner />");
  });
});
