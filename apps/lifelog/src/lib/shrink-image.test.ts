import { describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES } from "./photo-limits";
import {
  type CanvasLike,
  decodeOptionsFor,
  type DecodeOptions,
  type ImageBitmapLike,
  MAX_EDGE,
  PhotoShrinkError,
  scaleFor,
  type ShrinkDeps,
  shouldSkip,
  shrinkAll,
  shrinkImage,
} from "./shrink-image";

/** 縮小の依存を差し替えて、解放の呼ばれ方まで見えるようにする */
function fakeDeps(
  options: {
    width?: number;
    height?: number;
    blob?: Blob | null;
    noContext?: boolean;
  } = {},
) {
  const {
    width = 4000,
    height = 3000,
    blob = new Blob([new Uint8Array(10)], { type: "image/jpeg" }),
  } = options;

  const state = {
    /** createImageBitmap に渡されたデコード指定 */
    decodeCalls: [] as (DecodeOptions | undefined)[],
    /** 同時に開いている ImageBitmap の数 */
    openBitmaps: 0,
    /** 同時に開いた最大数。1 を超えたら複数枚を同時に持っている */
    maxOpenBitmaps: 0,
    closedBitmaps: 0,
    createdCanvases: 0,
    /** 解放後の canvas の大きさ */
    releasedSizes: [] as { width: number; height: number }[],
    drawnSizes: [] as { width: number; height: number }[],
  };

  const canvases: CanvasLike[] = [];

  const deps: ShrinkDeps = {
    createImageBitmap: async (
      _file: File,
      opts?: DecodeOptions,
    ): Promise<ImageBitmapLike> => {
      state.decodeCalls.push(opts);
      state.openBitmaps += 1;
      state.maxOpenBitmaps = Math.max(state.maxOpenBitmaps, state.openBitmaps);
      // ブラウザと同じく、指定されたぶんだけ縮小してデコードしたことにする
      const decodedWidth =
        opts?.resizeWidth ??
        (opts?.resizeHeight
          ? Math.round((width * opts.resizeHeight) / height)
          : width);
      const decodedHeight =
        opts?.resizeHeight ??
        (opts?.resizeWidth
          ? Math.round((height * opts.resizeWidth) / width)
          : height);
      return {
        width: decodedWidth,
        height: decodedHeight,
        close() {
          state.openBitmaps -= 1;
          state.closedBitmaps += 1;
        },
      };
    },
    createCanvas: (): CanvasLike => {
      state.createdCanvases += 1;
      const canvas: CanvasLike = {
        width: 0,
        height: 0,
        getContext: () =>
          options.noContext
            ? null
            : {
                drawImage: (_img, _dx, _dy, dw, dh) =>
                  void state.drawnSizes.push({ width: dw, height: dh }),
              },
        toBlob: (cb) => cb(blob),
      };
      canvases.push(canvas);
      return canvas;
    },
  };

  return {
    deps,
    state,
    /** 後始末できているかは、処理後の canvas の大きさで見る */
    collectReleased() {
      for (const c of canvases)
        state.releasedSizes.push({ width: c.width, height: c.height });
      return state.releasedSizes;
    },
  };
}

function fakeFile(
  name = "photo.jpg",
  type = "image/jpeg",
  bytes = 4 * 1024 * 1024,
): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("scaleFor", () => {
  it("長辺を 1600px に収める倍率を返す", () => {
    expect(scaleFor(4000, 3000)).toBeCloseTo(MAX_EDGE / 4000);
    expect(scaleFor(3000, 4000)).toBeCloseTo(MAX_EDGE / 4000);
  });
  it("すでに収まっていれば 1（拡大はしない）", () => {
    expect(scaleFor(800, 600)).toBe(1);
  });
  it("大きさが取れない画像でも 0 除算しない", () => {
    expect(scaleFor(0, 0)).toBe(1);
  });
});

describe("shouldSkip", () => {
  it("GIF はアニメが壊れるので触らない", () => {
    expect(shouldSkip(fakeFile("a.gif", "image/gif"))).toBe(true);
  });
  it("画像でないものは触らない", () => {
    expect(shouldSkip(fakeFile("a.pdf", "application/pdf"))).toBe(true);
  });
  it("JPEG は縮小の対象", () => {
    expect(shouldSkip(fakeFile())).toBe(false);
  });
});

describe("shrinkImage", () => {
  it("長辺 1600px の JPEG にする", async () => {
    const { deps, state } = fakeDeps({ width: 4000, height: 3000 });
    const out = await shrinkImage(
      fakeFile("IMG_0001.HEIC", "image/jpeg"),
      deps,
    );

    expect(out.type).toBe("image/jpeg");
    expect(out.name).toBe("IMG_0001.jpg");
    expect(state.drawnSizes[0]).toEqual({ width: 1600, height: 1200 });
  });

  it("使い終わった ImageBitmap を必ず解放する", async () => {
    const { deps, state } = fakeDeps();
    await shrinkImage(fakeFile(), deps);
    expect(state.closedBitmaps).toBe(1);
    expect(state.openBitmaps).toBe(0);
  });

  it("canvas を作れない端末でも ImageBitmap を解放し、理由を伝える", async () => {
    const { deps, state } = fakeDeps();
    const failing: ShrinkDeps = {
      ...deps,
      createCanvas: () => {
        throw new Error("canvas を作れません");
      },
    };
    await expect(
      shrinkImage(fakeFile("big.jpg"), failing),
    ).rejects.toBeInstanceOf(PhotoShrinkError);
    expect(state.openBitmaps).toBe(0);
    expect(state.closedBitmaps).toBe(1);
  });

  it("画像を読み込めない場合はどの写真か分かるエラーにする", async () => {
    const { deps } = fakeDeps();
    const failing: ShrinkDeps = {
      ...deps,
      createImageBitmap: () => Promise.reject(new Error("decode error")),
    };
    await expect(
      shrinkImage(fakeFile("IMG_9999.jpg"), failing),
    ).rejects.toThrow(/IMG_9999\.jpg/);
  });

  it("使い終わった canvas を 0x0 にして中身を手放す", async () => {
    const helper = fakeDeps();
    await shrinkImage(fakeFile(), helper.deps);
    expect(helper.collectReleased()).toEqual([{ width: 0, height: 0 }]);
  });

  it("1 回目で上限に収まらなければ、より小さい設定で試す", async () => {
    // 1 回目だけ上限を超える blob を返す
    let call = 0;
    const helper = fakeDeps();
    const deps: ShrinkDeps = {
      ...helper.deps,
      createCanvas: () => {
        const canvas = helper.deps.createCanvas();
        return {
          ...canvas,
          getContext: canvas.getContext.bind(canvas),
          toBlob: (cb) => {
            call += 1;
            const size = call === 1 ? MAX_PHOTO_BYTES + 1 : 1024;
            cb(new Blob([new Uint8Array(size)], { type: "image/jpeg" }));
          },
        };
      },
    };

    const out = await shrinkImage(fakeFile("huge.jpg"), deps);
    expect(call).toBe(2);
    expect(out.size).toBe(1024);
  });

  it("小さくて縮小の要らない画像はそのまま返す", async () => {
    const { deps, state } = fakeDeps({ width: 800, height: 600 });
    const file = fakeFile("small.jpg", "image/jpeg", 100 * 1024);
    expect(await shrinkImage(file, deps)).toBe(file);
    // 再エンコードしないが、開いた ImageBitmap は解放する
    expect(state.createdCanvases).toBe(0);
    expect(state.closedBitmaps).toBe(1);
  });

  it("縮小しきれなければ原本を送らずエラーにする", async () => {
    // 原本をそのまま送るとサーバの上限に当たり、分かりにくい失敗になる
    const { deps } = fakeDeps({ blob: null });
    await expect(
      shrinkImage(fakeFile("huge.jpg"), deps),
    ).rejects.toBeInstanceOf(PhotoShrinkError);
  });

  it("2D コンテキストが取れない端末でもエラーにし、ImageBitmap は解放する", async () => {
    const { deps, state } = fakeDeps({ noContext: true });
    await expect(shrinkImage(fakeFile("huge.jpg"), deps)).rejects.toThrow(
      /huge\.jpg/,
    );
    expect(state.closedBitmaps).toBe(1);
  });

  it("縮小できない形式（GIF）が上限を超えていたらエラーにする", async () => {
    const { deps } = fakeDeps();
    const big = fakeFile("anime.gif", "image/gif", MAX_PHOTO_BYTES + 1);
    await expect(shrinkImage(big, deps)).rejects.toThrow(/anime\.gif/);
  });

  it("上限内の GIF はそのまま通す", async () => {
    const { deps } = fakeDeps();
    const gif = fakeFile("anime.gif", "image/gif", 1024);
    expect(await shrinkImage(gif, deps)).toBe(gif);
  });
});

describe("shrinkAll", () => {
  it("複数枚でも同時に 1 枚しかデコードしない", async () => {
    const { deps, state } = fakeDeps();
    const files = [fakeFile("a.jpg"), fakeFile("b.jpg"), fakeFile("c.jpg")];

    const out = await shrinkAll(files, deps);

    expect(out.files).toHaveLength(3);
    expect(out.errors).toEqual([]);
    // ここが 2 以上になると、端末のメモリを同時に食って 2 枚目で落ちる
    expect(state.maxOpenBitmaps).toBe(1);
    expect(state.closedBitmaps).toBe(3);
  });

  it("空なら何もしない", async () => {
    const { deps, state } = fakeDeps();
    expect(await shrinkAll([], deps)).toEqual({ files: [], errors: [] });
    expect(state.closedBitmaps).toBe(0);
  });

  it("1 枚が駄目でも残りは取り込む", async () => {
    const helper = fakeDeps();
    const deps: ShrinkDeps = {
      ...helper.deps,
      createImageBitmap: (file: File) =>
        file.name === "broken.jpg"
          ? Promise.reject(new Error("decode error"))
          : helper.deps.createImageBitmap(file),
    };

    const out = await shrinkAll(
      [fakeFile("ok1.jpg"), fakeFile("broken.jpg"), fakeFile("ok2.jpg")],
      deps,
    );

    expect(out.files.map((f) => f.name)).toEqual(["ok1.jpg", "ok2.jpg"]);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]).toMatch(/broken\.jpg/);
  });
});

describe("decodeOptionsFor", () => {
  it("長辺が 1600px になるようデコード時に縮小させる", () => {
    // 実際に問題になった Ultra HDR の写真（3072x4080・12.5MB）
    expect(decodeOptionsFor({ width: 3072, height: 4080 })).toEqual({
      resizeWidth: 1205,
      resizeHeight: 1600,
      resizeQuality: "high",
    });
  });

  it("すでに小さい画像は縮小指定を付けない", () => {
    expect(decodeOptionsFor({ width: 800, height: 600 })).toEqual({
      resizeQuality: "high",
    });
  });

  it("寸法が読めない大きいファイルは幅だけ抑える", () => {
    expect(decodeOptionsFor(null, 12 * 1024 * 1024)).toEqual({
      resizeWidth: MAX_EDGE,
      resizeQuality: "high",
    });
  });

  it("寸法が読めない軽いファイルはそのままデコードする", () => {
    expect(decodeOptionsFor(null, 10 * 1024)).toEqual({
      resizeQuality: "high",
    });
  });
});

describe("大きな写真を原寸でデコードしない", () => {
  /** SOF0 だけを持つ JPEG のヘッダ。寸法を読ませるために使う */
  function jpegHeader(width: number, height: number): Uint8Array<ArrayBuffer> {
    return Uint8Array.from([
      0xff,
      0xd8,
      0xff,
      0xc0,
      0x00,
      0x11,
      0x08,
      (height >> 8) & 0xff,
      height & 0xff,
      (width >> 8) & 0xff,
      width & 0xff,
      0x03,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);
  }

  it("12.5MB / 3072x4080 の写真でもデコードは長辺 1600px に抑える", async () => {
    const { deps, state } = fakeDeps({ width: 3072, height: 4080 });
    // ヘッダ + 本体。原寸デコードすると 50MB 前後を確保してタブごと落ちる
    const file = new File(
      [jpegHeader(3072, 4080), new Uint8Array(1024 * 1024)],
      "PXL_0001.jpg",
      {
        type: "image/jpeg",
      },
    );

    const out = await shrinkImage(file, deps);

    expect(state.decodeCalls[0]).toEqual({
      resizeWidth: 1205,
      resizeHeight: 1600,
      resizeQuality: "high",
    });
    // デコード後の画像をさらに canvas で縮める必要はない
    expect(state.drawnSizes[0]).toEqual({ width: 1205, height: 1600 });
    expect(out.name).toBe("PXL_0001.jpg");
    expect(state.closedBitmaps).toBe(1);
  });
});
