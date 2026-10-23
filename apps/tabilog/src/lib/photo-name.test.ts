import { describe, expect, it } from "vitest";
import { photoFileName } from "./photo-name";

describe("photoFileName", () => {
  it("記録のタイトルと枚数から名前を作る", () => {
    expect(photoFileName("小籠包", 0, "image/jpeg")).toBe("小籠包-1.jpg");
    expect(photoFileName("小籠包", 2, "image/png")).toBe("小籠包-3.png");
  });

  it("空白はハイフンに寄せる", () => {
    expect(photoFileName("鼎泰豐  本店", 0, "image/webp")).toBe(
      "鼎泰豐-本店-1.webp",
    );
  });

  it("ファイル名に使えない文字は落とす", () => {
    expect(photoFileName('a/b:c*d?e"f<g>h|i', 0, "image/jpeg")).toBe(
      "a-b-c-d-e-f-g-h-i-1.jpg",
    );
    expect(photoFileName("../../etc/passwd", 0, "image/jpeg")).toBe(
      "..-..-etc-passwd-1.jpg",
    );
  });

  it("長いタイトルは切る", () => {
    const name = photoFileName("あ".repeat(100), 0, "image/jpeg");
    expect(name).toBe(`${"あ".repeat(40)}-1.jpg`);
  });

  it("名前が残らないタイトルでも保存できる名前になる", () => {
    expect(photoFileName("///", 0, "image/jpeg")).toBe("photo-1.jpg");
    expect(photoFileName("   ", 1, "image/gif")).toBe("photo-2.gif");
  });
});
