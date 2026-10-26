"use client";

import { useEffect, useId, useRef, useState } from "react";
import { resizeImage } from "@/lib/resizeImage";

type Props = {
  /** これから送る画像（選び直す前は null） */
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** 保存済みのレシートの URL。無ければ undefined */
  savedUrl?: string;
  onRemoveSaved?: () => void;
};

/** レシート画像を選んでプレビューする。選んだ画像は送る前にここで縮める */
export default function ReceiptPicker({
  file,
  onFileChange,
  savedUrl,
  onRemoveSaved,
}: Props) {
  const inputId = useId();
  // プレビューの URL は選んだときに作り、どの画像のものかを一緒に持つ。
  // 親が file を null に戻したら（取り消し・保存後）表示しない
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(
    null,
  );
  const previewRef = useRef(preview);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  // 閉じたときに最後のプレビューの URL を解放する
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current.url);
    },
    [],
  );

  const select = async (selected: File | undefined) => {
    if (!selected) return;
    setError(null);
    setProcessing(true);
    try {
      const resized = await resizeImage(selected);
      if (preview) URL.revokeObjectURL(preview.url);
      setPreview({ file: resized, url: URL.createObjectURL(resized) });
      onFileChange(resized);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(false);
    }
  };

  const previewUrl = preview && preview.file === file ? preview.url : null;
  const shownUrl = previewUrl ?? savedUrl;

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1 block text-sm text-gray-600 dark:text-gray-400"
      >
        レシート
      </label>

      {shownUrl && (
        <a href={shownUrl} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- 認証付きの API から返す画像で、next/image の最適化は通せない */}
          <img
            src={shownUrl}
            alt="レシート"
            className="mb-2 max-h-48 rounded-lg border border-gray-300 object-contain dark:border-gray-700"
          />
        </a>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="text-sm"
          disabled={processing}
          onChange={(e) => {
            void select(e.target.files?.[0]);
            // 同じ画像を選び直しても onChange が来るようにする
            e.target.value = "";
          }}
        />
        {file && (
          <button
            type="button"
            onClick={() => onFileChange(null)}
            className="rounded-lg bg-gray-200 px-3 py-1 text-sm dark:bg-gray-700"
          >
            取り消す
          </button>
        )}
        {!file && savedUrl && onRemoveSaved && (
          <button
            type="button"
            onClick={onRemoveSaved}
            className="rounded-lg bg-red-100 px-3 py-1 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300"
          >
            レシートを外す
          </button>
        )}
      </div>

      {processing && <p className="mt-1 text-xs text-gray-500">変換中…</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
