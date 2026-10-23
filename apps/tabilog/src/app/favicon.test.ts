import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * favicon.ico はブックマークや外部サービスが /favicon.ico を直接取りに来るために置いている。
 * 画像なので目で見ないと分からない部分もあるが、壊れた ICO を置いてしまう事故は防げる。
 */
const ico = readFileSync(join(process.cwd(), "src/app/favicon.ico"));

/** ICO のヘッダは 予約領域(2) + 種別(2) + 画像数(2) */
const count = ico.readUInt16LE(4);

describe("favicon.ico", () => {
  it("ICO として読める（予約領域 0・種別 1）", () => {
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(count).toBeGreaterThan(0);
  });

  it("16・32・48px を持つ（高解像度のタブでも粗くならない）", () => {
    const sizes = Array.from({ length: count }, (_, i) => {
      // 各エントリは 16 バイト。先頭が幅、次が高さ（0 は 256 を意味する）
      const at = 6 + i * 16;
      return ico[at] === 0 ? 256 : ico[at];
    });
    expect(sizes).toEqual([16, 32, 48]);
  });

  it("中身は PNG（アプリのアイコンから作っている）", () => {
    for (let i = 0; i < count; i++) {
      const at = 6 + i * 16;
      const offset = ico.readUInt32LE(at + 12);
      expect(ico.subarray(offset, offset + 4)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      );
    }
  });
});

describe("タブやホーム画面のアイコン", () => {
  const layout = readFileSync(
    join(process.cwd(), "src/app/layout.tsx"),
    "utf8",
  );

  it("大きい PNG も並べる（高解像度のタブ・ブックマーク用）", () => {
    expect(layout).toContain("/icons/icon-192.png");
  });

  it("iOS 用のアイコンも指定する", () => {
    expect(layout).toContain("/icons/apple-touch-icon.png");
  });
});
