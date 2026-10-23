import { describe, expect, it } from "vitest";
import {
  extensionForType,
  extractImageFiles,
  namePastedImage,
} from "./clipboard";

/** DataTransfer の最小限の代用。jsdom を使わずに検証する */
function fakeTransfer(opts: {
  items?: { kind: string; type: string; file: File | null }[];
  files?: File[];
}): DataTransfer {
  const items = opts.items?.map((i) => ({
    kind: i.kind,
    type: i.type,
    getAsFile: () => i.file,
  }));
  return {
    items: items as unknown as DataTransferItemList,
    files: opts.files as unknown as FileList,
  } as DataTransfer;
}

function image(type = "image/png", size = 100, name = "x.png"): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("extractImageFiles", () => {
  it("items から画像を取り出す", () => {
    const f = image();
    expect(
      extractImageFiles(
        fakeTransfer({ items: [{ kind: "file", type: "image/png", file: f }] }),
      ),
    ).toEqual([f]);
  });

  it("複数の画像をすべて返す", () => {
    const first = image("image/png", 10, "1.png");
    const second = image("image/jpeg", 10, "2.jpg");
    const got = extractImageFiles(
      fakeTransfer({
        items: [
          { kind: "file", type: "image/png", file: first },
          { kind: "file", type: "image/jpeg", file: second },
        ],
      }),
    );
    expect(got).toEqual([first, second]);
  });

  it("画像以外の item は無視する", () => {
    const got = extractImageFiles(
      fakeTransfer({
        items: [
          { kind: "string", type: "text/plain", file: null },
          {
            kind: "file",
            type: "application/pdf",
            file: image("application/pdf", 10, "a.pdf"),
          },
        ],
      }),
    );
    expect(got).toEqual([]);
  });

  it("items が空なら files を見る", () => {
    const f = image("image/jpeg", 10, "photo.jpg");
    expect(extractImageFiles(fakeTransfer({ items: [], files: [f] }))).toEqual([
      f,
    ]);
  });

  it("中身が空のファイルは無視する", () => {
    const empty = new File([], "empty.png", { type: "image/png" });
    expect(
      extractImageFiles(
        fakeTransfer({
          items: [{ kind: "file", type: "image/png", file: empty }],
        }),
      ),
    ).toEqual([]);
  });

  it("データが無ければ空", () => {
    expect(extractImageFiles(null)).toEqual([]);
    expect(extractImageFiles(undefined)).toEqual([]);
    expect(extractImageFiles(fakeTransfer({}))).toEqual([]);
  });
});

describe("namePastedImage", () => {
  const at = new Date(2026, 8, 12, 9, 5, 3);

  it("既定の image.png は日時入りの名前に置き換える", () => {
    const got = namePastedImage(
      new File([new Uint8Array(3)], "image.png", { type: "image/png" }),
      at,
    );
    expect(got.name).toBe("pasted-20260912090503.png");
    expect(got.type).toBe("image/png");
    expect(got.size).toBe(3);
  });

  it("名前が無い場合も付け直す", () => {
    const got = namePastedImage(
      new File([new Uint8Array(1)], "", { type: "image/jpeg" }),
      at,
    );
    expect(got.name).toBe("pasted-20260912090503.jpg");
  });

  it("同時に貼り付けた 2 枚目以降は連番が付く", () => {
    const got = namePastedImage(
      new File([new Uint8Array(1)], "image.png", { type: "image/png" }),
      at,
      1,
    );
    expect(got.name).toBe("pasted-20260912090503-2.png");
  });

  it("意味のある名前はそのまま残す", () => {
    const f = new File([new Uint8Array(1)], "ramen.png", { type: "image/png" });
    expect(namePastedImage(f, at)).toBe(f);
  });
});

describe("extensionForType", () => {
  it("MIME から拡張子を決める", () => {
    expect(extensionForType("image/png")).toBe("png");
    expect(extensionForType("image/webp")).toBe("webp");
    expect(extensionForType("image/gif")).toBe("gif");
    expect(extensionForType("image/jpeg")).toBe("jpg");
    expect(extensionForType("")).toBe("jpg");
  });
});
