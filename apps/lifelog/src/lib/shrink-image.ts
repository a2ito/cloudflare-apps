/**
 * 送信前に写真を縮小する処理。
 *
 * スマホのブラウザはタブごとのメモリが厳しく、デコード済みの画像
 * （ImageBitmap）を持ったままにすると 2 枚目で落ちることがある。
 * 1200 万画素の写真なら 1 枚で 48MB 前後を占めるため、
 *
 * - 使い終わった ImageBitmap は必ず close() する
 * - canvas も使い終わりに 0x0 にして中身を手放す
 * - 複数枚は同時ではなく 1 枚ずつ処理する
 *
 * を守る。
 *
 * また、縮小に失敗したときに原本をそのまま送ると、サーバの上限に当たって
 * 分かりにくい形で失敗する（実際にスマホで起きた）。小さい設定で順に
 * 試し、それでも収まらなければ「どの写真がなぜ駄目か」を伝える。
 *
 * DOM を直接触らないよう依存は引数で受け取り、テストできるようにしている。
 */

import { type ImageSize, readImageSize } from "./image-size";
import { formatBytes, MAX_PHOTO_BYTES } from "./photo-limits";

/** 縮小後の長辺（px） */
export const MAX_EDGE = 1600;
/** JPEG の品質 */
export const JPEG_QUALITY = 0.85;
/** これより小さく、かつ縮小も要らない画像はそのまま送る */
export const SKIP_BYTES = 500 * 1024;

/** 上から順に試す縮小設定。前の設定で上限に収まらなければ次を試す */
export const SHRINK_ATTEMPTS = [
  { maxEdge: MAX_EDGE, quality: JPEG_QUALITY },
  { maxEdge: 1200, quality: 0.75 },
  { maxEdge: 800, quality: 0.7 },
] as const;

export type ImageBitmapLike = {
  readonly width: number;
  readonly height: number;
  close(): void;
};

export type Context2dLike = {
  drawImage(
    image: ImageBitmapLike,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
};

export type CanvasLike = {
  width: number;
  height: number;
  getContext(contextId: "2d"): Context2dLike | null;
  toBlob(
    callback: (blob: Blob | null) => void,
    type?: string,
    quality?: number,
  ): void;
};

/** createImageBitmap に渡す縮小指定。原寸デコードを避けるために使う */
export type DecodeOptions = {
  resizeWidth?: number;
  resizeHeight?: number;
  resizeQuality?: "pixelated" | "low" | "medium" | "high";
};

export type ShrinkDeps = {
  createImageBitmap: (
    file: File,
    options?: DecodeOptions,
  ) => Promise<ImageBitmapLike>;
  createCanvas: () => CanvasLike;
};

/** 縮小できなかった写真。どれが駄目かを画面に出すため名前を持つ */
export class PhotoShrinkError extends Error {
  constructor(
    readonly fileName: string,
    message: string,
  ) {
    super(message);
    this.name = "PhotoShrinkError";
  }
}

/** 長辺を maxEdge に収める倍率。すでに収まっていれば 1 */
export function scaleFor(
  width: number,
  height: number,
  maxEdge: number = MAX_EDGE,
): number {
  const longest = Math.max(width, height);
  if (longest <= 0) return 1;
  return Math.min(1, maxEdge / longest);
}

/** 縮小せずそのまま送ってよい画像か（GIF はアニメが壊れるので触らない） */
export function shouldSkip(file: File): boolean {
  return !file.type.startsWith("image/") || file.type === "image/gif";
}

function toJpegName(name: string): string {
  return `${name.replace(/\.[^.]+$/, "")}.jpg`;
}

/**
 * デコード時にどこまで縮小させるか。
 * 寸法が分かれば長辺を MAX_EDGE に合わせ、分からなければ幅だけ抑える
 * （縦長でも原寸デコードにはならない）。
 */
export function decodeOptionsFor(
  size: ImageSize | null,
  fileSize = 0,
): DecodeOptions {
  if (!size) {
    // 寸法が読めない。軽いファイルはそのまま、大きいものだけ幅で抑える
    return fileSize > SKIP_BYTES
      ? { resizeWidth: MAX_EDGE, resizeQuality: "high" }
      : { resizeQuality: "high" };
  }
  const scale = scaleFor(size.width, size.height);
  if (scale === 1) return { resizeQuality: "high" };
  return {
    resizeWidth: Math.max(1, Math.round(size.width * scale)),
    resizeHeight: Math.max(1, Math.round(size.height * scale)),
    resizeQuality: "high",
  };
}

/** 1 回ぶんの描き出し。失敗したら null を返す */
async function renderOnce(
  bitmap: ImageBitmapLike,
  deps: ShrinkDeps,
  attempt: { maxEdge: number; quality: number },
): Promise<Blob | null> {
  let canvas: CanvasLike | null = null;
  try {
    const scale = scaleFor(bitmap.width, bitmap.height, attempt.maxEdge);
    canvas = deps.createCanvas();
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const target = canvas;
    return await new Promise<Blob | null>((resolve) =>
      target.toBlob(resolve, "image/jpeg", attempt.quality),
    );
  } catch {
    // 大きすぎる画像では canvas の確保自体が失敗する。次の設定に任せる
    return null;
  } finally {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

/**
 * 1 枚を上限に収まるまで縮小する。
 * 収められない場合は PhotoShrinkError を投げる（原本を黙って送らない）。
 */
export async function shrinkImage(
  file: File,
  deps: ShrinkDeps,
  limitBytes: number = MAX_PHOTO_BYTES,
): Promise<File> {
  if (shouldSkip(file)) {
    if (file.size > limitBytes) {
      throw new PhotoShrinkError(
        file.name,
        `「${file.name}」は ${formatBytes(file.size)} あり、この形式では縮小できません（上限 ${formatBytes(limitBytes)}）`,
      );
    }
    return file;
  }

  // 原寸でデコードすると 1200 万画素で 50MB 前後を確保してしまい、
  // スマホではタブごと落ちる。デコードの時点で縮小させる
  const size = await readImageSize(file);
  if (size && scaleFor(size.width, size.height) === 1 && file.size < SKIP_BYTES)
    return file;

  let bitmap: ImageBitmapLike | null = null;
  try {
    try {
      bitmap = await deps.createImageBitmap(
        file,
        decodeOptionsFor(size, file.size),
      );
    } catch {
      throw new PhotoShrinkError(
        file.name,
        `「${file.name}」を読み込めませんでした。写真アプリで小さくしてからお試しください`,
      );
    }

    // 寸法が読めない画像でも、念のためここで判断できるようにしておく
    if (
      !size &&
      scaleFor(bitmap.width, bitmap.height) === 1 &&
      file.size < SKIP_BYTES
    )
      return file;

    for (const attempt of SHRINK_ATTEMPTS) {
      const blob = await renderOnce(bitmap, deps, attempt);
      if (blob && blob.size <= limitBytes) {
        return new File([blob], toJpegName(file.name), { type: "image/jpeg" });
      }
    }

    throw new PhotoShrinkError(
      file.name,
      `「${file.name}」は縮小できませんでした。写真アプリでサイズを小さくしてからお試しください`,
    );
  } finally {
    // デコード済みの画素はここで手放す。GC を待つと次の 1 枚と重なって落ちる
    bitmap?.close();
  }
}

export type ShrinkResult = {
  /** 送信できる状態になった写真 */
  files: File[];
  /** 取り込めなかった写真の理由。画面にそのまま出す */
  errors: string[];
};

/**
 * 複数枚を縮小する。
 * Promise.all にすると枚数分のメモリが同時に乗るので、必ず 1 枚ずつ処理する。
 * 1 枚が駄目でも残りは取り込む。
 */
export async function shrinkAll(
  files: readonly File[],
  deps: ShrinkDeps,
  limitBytes: number = MAX_PHOTO_BYTES,
): Promise<ShrinkResult> {
  const result: ShrinkResult = { files: [], errors: [] };
  for (const file of files) {
    try {
      result.files.push(await shrinkImage(file, deps, limitBytes));
    } catch (err) {
      result.errors.push(
        err instanceof PhotoShrinkError
          ? err.message
          : `「${file.name}」を取り込めませんでした`,
      );
    }
  }
  return result;
}

/** ブラウザ上での実際の依存 */
export const browserShrinkDeps: ShrinkDeps = {
  createImageBitmap: (file, options) =>
    globalThis.createImageBitmap(file, options),
  createCanvas: () => document.createElement("canvas") as unknown as CanvasLike,
};
