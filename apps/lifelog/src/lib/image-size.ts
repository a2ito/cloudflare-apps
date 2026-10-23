/**
 * 画像をデコードせずに、ファイル先頭のヘッダだけから寸法を読む。
 *
 * createImageBitmap() は原寸でデコードするため、1200 万画素の写真なら
 * 50MB 前後（Ultra HDR ならさらに倍）を一気に確保してしまい、
 * スマホのブラウザではタブごと落ちる。
 *
 * デコード時に縮小させるには縮小後の寸法を先に決める必要があり、
 * そのために使う。読むのはヘッダの数十 KB だけ。
 */

/** ヘッダを探す範囲。Ultra HDR は EXIF/XMP が大きいので広めに取る */
const HEADER_BYTES = 512 * 1024;

export type ImageSize = { width: number; height: number };

/** JPEG で実際の寸法を持つマーカー（DHT/DAC/RST などは除く） */
const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

export function parseJpegSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let i = 2;
  while (i + 9 < bytes.length) {
    // マーカーは 0xFF で始まる。詰め物の 0xFF が続くことがある
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    // データを持たないマーカー
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      i += 2;
      continue;
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2) return null;
    if (SOF_MARKERS.has(marker)) {
      // marker(2) + length(2) + precision(1) の次に height, width が並ぶ
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    i += 2 + length;
  }
  return null;
}

export function parsePngSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (signature.some((b, i) => bytes[i] !== b)) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

export function parseImageSize(bytes: Uint8Array): ImageSize | null {
  return parseJpegSize(bytes) ?? parsePngSize(bytes);
}

/** 寸法が分からなければ null。呼び出し側は安全側に倒すこと */
export async function readImageSize(file: File): Promise<ImageSize | null> {
  try {
    const head = await file.slice(0, HEADER_BYTES).arrayBuffer();
    return parseImageSize(new Uint8Array(head));
  } catch {
    return null;
  }
}
