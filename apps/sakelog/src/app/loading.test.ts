import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * すべてのページが動的（ログインと D1 を見る）なので、loading.tsx が無いと
 * 遷移のあいだ前の画面のまま固まって見える。ページを足したときの付け忘れを防ぐ。
 */
const APP_DIR = join(process.cwd(), "src/app");

/** 遷移の待ちが起きないページは対象外にする */
const EXCLUDED = ["login", "offline"];

function findPages(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!EXCLUDED.includes(name) && name !== "api") findPages(path, found);
    } else if (name === "page.tsx") {
      found.push(dir);
    }
  }
  return found;
}

describe("読み込み中の表示", () => {
  const pageDirs = findPages(APP_DIR);

  it("ページを見つけられている（このテスト自体の前提）", () => {
    // 一覧・新規・詳細・編集の 4 つ。ページを足したらここも増える
    expect(pageDirs.length).toBeGreaterThanOrEqual(4);
  });

  it.each(pageDirs.map((dir) => [relative(APP_DIR, dir) || "."] as const))(
    "%s に loading.tsx がある",
    (dir) => {
      const files = readdirSync(join(APP_DIR, dir === "." ? "" : dir));
      expect(files, `${dir} に loading.tsx を置いてください`).toContain(
        "loading.tsx",
      );
    },
  );
});

describe("遷移中のリンクの反応", () => {
  const source = readFileSync(
    join(process.cwd(), "src/components/link-pending.tsx"),
    "utf8",
  );

  it("Next.js の useLinkStatus で遷移待ちを見る", () => {
    expect(source).toContain("useLinkStatus");
  });

  it("場所を常に確保して、出入りで文字がずれないようにする", () => {
    expect(source).toMatch(/h-4 w-4/);
    expect(source).toMatch(
      /opacity-100.*:.*opacity-0|pending \? "opacity-100" : "opacity-0"/s,
    );
  });
});
