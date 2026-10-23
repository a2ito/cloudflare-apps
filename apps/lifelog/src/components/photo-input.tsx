"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { extractImageFiles, namePastedImage } from "@/lib/clipboard";
import { MAX_PHOTOS_PER_ENTRY } from "@/lib/photo-limits";
import { browserShrinkDeps, MAX_EDGE, shrinkAll } from "@/lib/shrink-image";
import { inputClass, Spinner } from "./ui";

type Picked = { file: File; url: string };

/**
 * 複数枚の写真を縮小してから送信する input。
 * ファイル選択のほか、画面のどこでも画像を貼り付けて追加できる。
 */
export function PhotoInput({
  name,
  existing = 0,
}: {
  name: string;
  existing?: number;
}) {
  // すでに付いている写真と合わせて上限に収める
  const maxFiles = Math.max(0, MAX_PHOTOS_PER_ENTRY - existing);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 画面を離れるときに解放するため、最新の一覧を ref にも控えておく
  const pickedRef = useRef<Picked[]>([]);

  // input.files はコードから直接代入できないため DataTransfer を経由して同期する
  useEffect(() => {
    pickedRef.current = picked;
    const input = inputRef.current;
    if (!input) return;
    const dt = new DataTransfer();
    for (const p of picked) dt.items.add(p.file);
    input.files = dt.files;
  }, [picked]);

  // プレビュー用に作った URL を解放する（個別の削除時は remove の中で解放する）
  useEffect(() => {
    return () => {
      for (const p of pickedRef.current) URL.revokeObjectURL(p.url);
    };
  }, []);

  const addFiles = useCallback(
    async (files: readonly File[], source: "select" | "paste") => {
      if (files.length === 0) return;

      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        // 1 枚ずつ縮小する。まとめて処理すると端末のメモリを食い潰して落ちる。
        // 縮小できなかった写真は取り込まず、理由を画面に出す
        const shrunk = await shrinkAll(files, browserShrinkDeps);
        if (shrunk.errors.length > 0) setError(shrunk.errors.join(" / "));
        if (shrunk.files.length === 0) return;

        setPicked((current) => {
          const room = maxFiles - current.length;
          if (room <= 0) {
            setError(`写真は ${maxFiles} 枚までです`);
            return current;
          }
          if (shrunk.files.length > room)
            setError(
              `写真は ${maxFiles} 枚までなので、${room} 枚だけ追加しました`,
            );
          const added = shrunk.files
            .slice(0, room)
            .map((file) => ({ file, url: URL.createObjectURL(file) }));
          if (source === "paste" && shrunk.errors.length === 0) {
            setNotice(`貼り付けた画像を ${added.length} 枚追加しました`);
          }
          return [...current, ...added];
        });
      } catch (err) {
        console.error("写真の取り込みに失敗しました", err);
        setError("写真の取り込みに失敗しました");
      } finally {
        setBusy(false);
      }
    },
    [maxFiles],
  );

  // どこにフォーカスがあっても貼り付けを受け取れるようにする。
  // 画像を含まない貼り付けは素通しするので、文字入力の邪魔はしない。
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const images = extractImageFiles(e.clipboardData);
      if (images.length === 0) return;
      e.preventDefault();
      const now = new Date();
      void addFiles(
        images.map((f, i) => namePastedImage(f, now, i)),
        "paste",
      );
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.currentTarget.files ?? [])];
    // 同期し直すので input 自体の選択状態は捨ててよい
    e.currentTarget.value = "";
    void addFiles(files, "select");
  }

  function remove(url: string) {
    setPicked((current) => {
      URL.revokeObjectURL(url);
      return current.filter((p) => p.url !== url);
    });
    setError(null);
  }

  return (
    <div className="space-y-2">
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {picked.map((p) => (
            <div key={p.url} className="relative">
              <img
                src={p.url}
                alt=""
                className="h-24 w-24 rounded-md border border-zinc-200 bg-zinc-100 object-cover dark:border-zinc-700 dark:bg-zinc-800"
              />
              <button
                type="button"
                onClick={() => remove(p.url)}
                aria-label="この写真を外す"
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm text-zinc-600 shadow-sm hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/*"
        multiple
        onChange={onChange}
        className={inputClass}
      />
      <p className="text-xs text-zinc-500">
        最大 {maxFiles}{" "}
        枚。画像をコピーして、この画面で貼り付けても追加できます（送信前に長辺{" "}
        {MAX_EDGE}px へ縮小）
      </p>
      {busy && (
        <p className="flex items-center gap-2 text-xs text-zinc-500">
          <Spinner className="h-3.5 w-3.5" />
          写真を取り込み中…
        </p>
      )}
      {notice && (
        <p className="text-xs text-sky-700 dark:text-sky-400">{notice}</p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
