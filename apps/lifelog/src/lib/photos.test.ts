import { describe, expect, it } from "vitest";
import { fakeImage } from "@/test/d1";
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_ENTRY } from "./photo-limits";
import { nonEmptyFiles, photoUrl, validatePhotos } from "./photos";

describe("validatePhotos", () => {
  it("対応形式で上限内なら通す", () => {
    expect(
      validatePhotos([fakeImage("image/jpeg"), fakeImage("image/webp")]),
    ).toBeNull();
  });
  it("形式・サイズ・枚数を弾く", () => {
    expect(validatePhotos([fakeImage("image/heic")])).toMatch(
      /対応していない画像形式/,
    );
    expect(
      validatePhotos([fakeImage("image/jpeg", MAX_PHOTO_BYTES + 1)]),
    ).toMatch(/以下にしてください/);
    expect(
      validatePhotos(
        Array.from({ length: MAX_PHOTOS_PER_ENTRY + 1 }, () => fakeImage()),
      ),
    ).toMatch(/枚まで/);
  });
  it("すでに付いている枚数と合わせて数える", () => {
    expect(validatePhotos([fakeImage()], MAX_PHOTOS_PER_ENTRY - 1)).toBeNull();
    expect(
      validatePhotos([fakeImage(), fakeImage()], MAX_PHOTOS_PER_ENTRY - 1),
    ).toMatch(/あと 1 枚/);
    expect(validatePhotos([fakeImage()], MAX_PHOTOS_PER_ENTRY)).toMatch(
      /先に不要な写真を削除/,
    );
  });
});

describe("nonEmptyFiles", () => {
  it("中身の無いファイルを除く", () => {
    expect(nonEmptyFiles([new File([], ""), fakeImage()])).toHaveLength(1);
  });
});

describe("photoUrl", () => {
  it("私的な写真なので、必ず持ち主を確かめる /api/photos を通す", () => {
    expect(photoUrl("entries/1/abc.jpg")).toBe("/api/photos/entries/1/abc.jpg");
  });
});
