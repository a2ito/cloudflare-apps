"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { extractImageFile, namePastedImage } from "@/lib/clipboard";
import { planShrink, type ShrinkProfile } from "@/lib/image-shrink";
import { inputClass } from "./ui";

const JPEG_QUALITY = 0.85;

/** スマホ写真をそのまま送らず、用途に合った大きさの JPEG に縮小してからアップロードする */
async function shrinkImage(file: File, profile: ShrinkProfile): Promise<File> {
	if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
	const bitmap = await createImageBitmap(file);
	const plan = planShrink({ type: file.type, size: file.size, width: bitmap.width, height: bitmap.height }, profile);
	if (plan.kind === "keep") return file;

	const canvas = document.createElement("canvas");
	canvas.width = plan.width;
	canvas.height = plan.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) return file;
	// JPEG は透過を持てず、透明な部分が黒くなるため白で下塗りする
	ctx.fillStyle = "#fff";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
	if (!blob) return file;
	return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function ImageInput({ name, currentUrl, profile }: { name: string; currentUrl?: string | null; profile: ShrinkProfile }) {
	const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	// プレビュー用に作った URL は差し替え時に解放する
	const objectUrlRef = useRef<string | null>(null);

	const showPreview = useCallback((file: File) => {
		if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
		const url = URL.createObjectURL(file);
		objectUrlRef.current = url;
		setPreview(url);
	}, []);

	useEffect(() => {
		return () => {
			if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
		};
	}, []);

	/** 受け取ったファイルを縮小し、送信対象の input に載せる */
	const acceptFile = useCallback(
		async (file: File, source: "select" | "paste") => {
			const input = inputRef.current;
			if (!input) return;

			setBusy(true);
			setNotice(null);
			try {
				const shrunk = await shrinkImage(file, profile);
				// input.files はコードから直接代入できないため DataTransfer を経由する
				const dt = new DataTransfer();
				dt.items.add(shrunk);
				input.files = dt.files;
				showPreview(shrunk);
				if (source === "paste") setNotice("貼り付けた画像を取り込みました");
			} catch (err) {
				console.error("画像の取り込みに失敗しました", err);
				showPreview(file);
			} finally {
				setBusy(false);
			}
		},
		[showPreview, profile],
	);

	// どこにフォーカスがあっても貼り付けを受け取れるようにする。
	// 画像を含まない貼り付けは素通しするので、文字入力の邪魔はしない。
	useEffect(() => {
		function onPaste(e: ClipboardEvent) {
			const file = extractImageFile(e.clipboardData);
			if (!file) return;
			e.preventDefault();
			void acceptFile(namePastedImage(file), "paste");
		}
		window.addEventListener("paste", onPaste);
		return () => window.removeEventListener("paste", onPaste);
	}, [acceptFile]);

	function onChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.currentTarget.files?.[0];
		if (file) void acceptFile(file, "select");
	}

	return (
		<div className="space-y-2">
			{preview && (
				<img src={preview} alt="" className="h-40 w-40 rounded-md border border-zinc-200 bg-zinc-100 object-contain dark:border-zinc-700 dark:bg-zinc-800" />
			)}
			<input ref={inputRef} type="file" name={name} accept="image/*" onChange={onChange} className={inputClass} />
			<p className="text-xs text-zinc-500">画像をコピーして、この画面で貼り付けても登録できます</p>
			{busy && <p className="text-xs text-zinc-500">画像を取り込み中…</p>}
			{notice && <p className="text-xs text-emerald-700 dark:text-emerald-400">{notice}</p>}
		</div>
	);
}
