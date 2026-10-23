import { describe, expect, it } from "vitest";
import {
  parseImageSize,
  parseJpegSize,
  parsePngSize,
  readImageSize,
} from "./image-size";

/** SOF0 セグメントだけを持つ最小の JPEG。前に任意のセグメントを挟める */
function jpeg(
  width: number,
  height: number,
  segmentsBefore: Uint8Array[] = [],
): Uint8Array<ArrayBuffer> {
  const sof = new Uint8Array([
    0xff,
    0xc0,
    0x00,
    0x11, // length = 17
    0x08, // precision
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03, // components
    ...new Array(6).fill(0),
  ]);
  const parts = [new Uint8Array([0xff, 0xd8]), ...segmentsBefore, sof];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** APP1（EXIF）のような、SOF の前に挟まる大きめのセグメント */
function app1(payloadBytes: number): Uint8Array {
  const length = payloadBytes + 2;
  return new Uint8Array([
    0xff,
    0xe1,
    (length >> 8) & 0xff,
    length & 0xff,
    ...new Array(payloadBytes).fill(0x20),
  ]);
}

function png(width: number, height: number): Uint8Array {
  const out = new Uint8Array(24);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(out.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return out;
}

describe("parseJpegSize", () => {
  it("SOF0 から寸法を読む", () => {
    expect(parseJpegSize(jpeg(3072, 4080))).toEqual({
      width: 3072,
      height: 4080,
    });
  });

  it("EXIF など前置きのセグメントを読み飛ばす", () => {
    // Ultra HDR の写真は EXIF/XMP が大きく、SOF はかなり後ろにある
    expect(parseJpegSize(jpeg(3072, 4080, [app1(60000), app1(20000)]))).toEqual(
      { width: 3072, height: 4080 },
    );
  });

  it("プログレッシブ JPEG（SOF2）も読める", () => {
    const bytes = jpeg(800, 600);
    // SOF0 のマーカーだけ SOF2 に差し替える
    bytes[bytes.indexOf(0xc0, 2)] = 0xc2;
    expect(parseJpegSize(bytes)).toEqual({ width: 800, height: 600 });
  });

  it("JPEG でなければ null", () => {
    expect(parseJpegSize(png(10, 10))).toBeNull();
    expect(parseJpegSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("parsePngSize", () => {
  it("IHDR から寸法を読む", () => {
    expect(parsePngSize(png(1920, 1080))).toEqual({
      width: 1920,
      height: 1080,
    });
  });
  it("PNG でなければ null", () => {
    expect(parsePngSize(jpeg(10, 10))).toBeNull();
  });
});

describe("parseImageSize", () => {
  it("JPEG も PNG も扱える", () => {
    expect(parseImageSize(jpeg(100, 200))).toEqual({ width: 100, height: 200 });
    expect(parseImageSize(png(300, 400))).toEqual({ width: 300, height: 400 });
  });
  it("判別できない形式は null（呼び出し側が安全側に倒す）", () => {
    expect(parseImageSize(new Uint8Array(32))).toBeNull();
  });
});

describe("readImageSize", () => {
  it("File の先頭だけを読んで寸法を返す", async () => {
    const file = new File([jpeg(3072, 4080, [app1(30000)])], "IMG_0001.jpg", {
      type: "image/jpeg",
    });
    expect(await readImageSize(file)).toEqual({ width: 3072, height: 4080 });
  });

  it("壊れたファイルでも例外にしない", async () => {
    const file = new File([new Uint8Array(100)], "broken.jpg", {
      type: "image/jpeg",
    });
    expect(await readImageSize(file)).toBeNull();
  });
});
