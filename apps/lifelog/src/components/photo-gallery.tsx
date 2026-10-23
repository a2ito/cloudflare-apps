"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deletePhotoAction } from "@/app/actions/entries";
import { ConfirmForm, DangerButton } from "./ui";

/** 表示に必要なものだけ。URL とダウンロード名はサーバ側で作って渡す */
export type GalleryPhoto = { id: number; src: string; downloadName: string };

const viewerButtonClass =
  "rounded-md border border-white/40 bg-black/50 px-3 py-1.5 text-sm font-medium text-white hover:bg-black/70";

/**
 * 日記の写真の一覧と、1 枚を画面いっぱいに出すビューア。
 *
 * ビューアは <dialog> の showModal で開く。Escape で閉じることと、
 * 背面へフォーカスが抜けないことをブラウザに任せられるため。
 */
export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // 開いていた写真が消えた（別の端末で削除された）ときは、番号が範囲外になるので開かない
  const open = openIndex === null ? undefined : photos[openIndex];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // close() は close イベントを出すので、開いている番号は onClose 側で戻す
    if (!open) {
      if (dialog.open) dialog.close();
    } else if (!dialog.open) {
      dialog.showModal();
    }
  }, [open]);

  const step = useCallback(
    (by: number) => {
      setOpenIndex((current) =>
        current === null
          ? null
          : (current + by + photos.length) % photos.length,
      );
    },
    [photos.length],
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <div key={photo.id} className="space-y-1">
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={`${index + 1} 枚目を拡大する`}
              className="block w-full cursor-zoom-in rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <img
                src={photo.src}
                alt=""
                className="aspect-square w-full rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
              />
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <ConfirmForm
                action={deletePhotoAction}
                message="この写真を削除しますか？"
              >
                <input type="hidden" name="id" value={photo.id} />
                <DangerButton>写真を削除</DangerButton>
              </ConfirmForm>
            </div>
          </div>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setOpenIndex(null)}
        // 写真の外側（背景）を押したら閉じる
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpenIndex(null);
        }}
        onKeyDown={(e) => {
          if (photos.length < 2) return;
          if (e.key === "ArrowRight") {
            e.preventDefault();
            step(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            step(-1);
          }
        }}
        className="max-h-dvh max-w-full bg-transparent p-0 backdrop:bg-black/80"
      >
        {open && (
          <div className="flex flex-col items-center gap-3 p-4">
            <img
              src={open.src}
              alt=""
              className="max-h-[75dvh] max-w-full rounded-md object-contain"
            />
            <div className="flex flex-wrap items-center justify-center gap-2">
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="前の写真"
                    className={viewerButtonClass}
                  >
                    ←
                  </button>
                  <span className="text-sm text-white">
                    {(openIndex ?? 0) + 1} / {photos.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="次の写真"
                    className={viewerButtonClass}
                  >
                    →
                  </button>
                </>
              )}
              {/* 同じオリジンから配信しているので download でそのまま保存できる */}
              <a
                href={open.src}
                download={open.downloadName}
                className={viewerButtonClass}
              >
                ダウンロード
              </a>
              <button
                type="button"
                onClick={() => setOpenIndex(null)}
                className={viewerButtonClass}
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
