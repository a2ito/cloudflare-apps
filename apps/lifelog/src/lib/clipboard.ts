/** 貼り付けやドラッグで運ばれてきたデータから、画像ファイルをすべて取り出す */
export function extractImageFiles(
  data: DataTransfer | null | undefined,
): File[] {
  if (!data) return [];

  // items が使える場合はこちらを優先する。貼り付けでは files が空のことがある
  const fromItems: File[] = [];
  if (data.items) {
    for (const item of Array.from(data.items)) {
      if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (file && file.size > 0) fromItems.push(file);
    }
  }
  if (fromItems.length > 0) return fromItems;

  if (data.files) {
    return Array.from(data.files).filter(
      (f) => f.type.startsWith("image/") && f.size > 0,
    );
  }
  return [];
}

/**
 * 貼り付けた画像にはファイル名が無いことが多いので、日時から名前を付ける。
 * 拡張子は MIME から決める。同時に複数貼り付けたときのために連番を添える。
 */
export function namePastedImage(
  file: File,
  now: Date = new Date(),
  index = 0,
): File {
  if (file.name && file.name !== "image.png" && !file.name.startsWith("blob"))
    return file;

  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const suffix = index > 0 ? `-${index + 1}` : "";

  return new File(
    [file],
    `pasted-${stamp}${suffix}.${extensionForType(file.type)}`,
    { type: file.type },
  );
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
