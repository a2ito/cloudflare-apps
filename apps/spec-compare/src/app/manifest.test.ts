import { describe, expect, it } from "vitest";
import manifest, { THEME_COLOR } from "./manifest";

describe("manifest", () => {
  const m = manifest();

  it("インストールに必要な項目が揃っている", () => {
    expect(m.name).toBe("スペック比較");
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
  });

  it("Chrome が要求する 192 と 512 のアイコンを持つ", () => {
    const sizes = m.icons
      ?.filter((i) => i.purpose !== "maskable")
      .map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  });

  it("Android のアダプティブアイコン用に maskable を持つ", () => {
    expect(m.icons?.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("アイコンはすべて絶対パスの PNG を指す", () => {
    for (const icon of m.icons ?? []) {
      expect(icon.src).toMatch(/^\/.+\.png$/);
      expect(icon.type).toBe("image/png");
    }
  });

  it("テーマ色はファビコンの背景と揃っている", () => {
    expect(m.theme_color).toBe(THEME_COLOR);
    expect(THEME_COLOR).toBe("#4f46e5");
  });
});
