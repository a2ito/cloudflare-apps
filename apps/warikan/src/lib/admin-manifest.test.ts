import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../app/manifest";
import { adminManifest } from "./admin-manifest";

const m = adminManifest();

describe("adminManifest", () => {
  it("一般向けと id が違い、別のアプリとしてインストールされる", () => {
    const mainId = manifest().id ?? manifest().start_url;
    expect(m.id).not.toBe(mainId);
  });

  it("/admin から起動し、起動ページが scope に入る", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/admin");
    expect(String(m.start_url).startsWith(String(m.scope))).toBe(true);
  });

  it("インストールに必要なアイコンが public に実在する", () => {
    const icons = m.icons ?? [];
    expect(icons.map((i) => i.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"]),
    );
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
    for (const icon of icons) {
      const path = join(process.cwd(), "public", String(icon.src));
      expect(existsSync(path), `${icon.src} がありません`).toBe(true);
    }
  });

  it("iOS 用の管理画面のアイコンがある", () => {
    expect(
      existsSync(join(process.cwd(), "src/app/admin/apple-icon.png")),
    ).toBe(true);
  });
});
