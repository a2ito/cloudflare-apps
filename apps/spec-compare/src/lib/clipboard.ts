/** 貼り付けやドラッグで運ばれてきたデータから、最初の画像ファイルを取り出す */
export function extractImageFile(data: DataTransfer | null | undefined): File | null {
	if (!data) return null;

	// items が使える場合はこちらを優先する。貼り付けでは files が空のことがある
	const items = data.items;
	if (items) {
		for (const item of Array.from(items)) {
			if (item.kind !== "file") continue;
			if (!item.type.startsWith("image/")) continue;
			const file = item.getAsFile();
			if (file && file.size > 0) return file;
		}
	}

	const files = data.files;
	if (files) {
		for (const file of Array.from(files)) {
			if (file.type.startsWith("image/") && file.size > 0) return file;
		}
	}

	return null;
}

/**
 * 貼り付けた画像にはファイル名が無いことが多いので、日時から名前を付ける。
 * 拡張子は MIME から決める。
 */
export function namePastedImage(file: File, now: Date = new Date()): File {
	if (file.name && file.name !== "image.png" && !file.name.startsWith("blob")) return file;

	const ext = extensionForType(file.type);
	const stamp = [
		now.getFullYear(),
		String(now.getMonth() + 1).padStart(2, "0"),
		String(now.getDate()).padStart(2, "0"),
		String(now.getHours()).padStart(2, "0"),
		String(now.getMinutes()).padStart(2, "0"),
		String(now.getSeconds()).padStart(2, "0"),
	].join("");

	return new File([file], `pasted-${stamp}.${ext}`, { type: file.type });
}

export function extensionForType(type: string): string {
	switch (type) {
		case "image/png":
			return "png";
		case "image/webp":
			return "webp";
		case "image/gif":
			return "gif";
		default:
			return "jpg";
	}
}
