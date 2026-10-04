import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

const m = manifest();

describe("manifest", () => {
  it("ホーム画面から単独のアプリとして起動する", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
  });

  it("インストールに必要な 192 と 512 のアイコンを持つ", () => {
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("端末の形に切り抜かれる maskable アイコンを持つ", () => {
    expect((m.icons ?? []).some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("参照しているアイコンが public に実在する", () => {
    for (const icon of m.icons ?? []) {
      const path = join(process.cwd(), "public", String(icon.src));
      expect(existsSync(path), `${icon.src} がありません`).toBe(true);
    }
  });

  it("iOS 用のアイコンがある", () => {
    expect(existsSync(join(process.cwd(), "src/app/apple-icon.png"))).toBe(true);
  });

  it("名前と色が設定されている", () => {
    expect(m.short_name).toBe("warikan");
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
