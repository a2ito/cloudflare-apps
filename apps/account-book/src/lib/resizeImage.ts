// レシートの文字が読める程度に残しつつ、スマホの写真（数 MB）を数百 KB に縮める
const MAX_EDGE = 1600;
const QUALITY = 0.85;

/**
 * ブラウザで画像を長辺 MAX_EDGE 以下の JPEG に変換する。
 * iPhone の HEIC もブラウザが読めればここで JPEG になるので、サーバは jpeg/png/webp だけ受ければよい
 */
export const resizeImage = async (file: File): Promise<File> => {
  const bitmap = await createImageBitmap(file).catch((err: unknown) => {
    throw new Error("画像を読み込めませんでした", { cause: err });
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像を変換できませんでした");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) throw new Error("画像を変換できませんでした");

  const name = file.name.replace(/\.[^.]+$/, "") || "receipt";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
};

/** 明細にレシートを送る。失敗したらサーバのエラーコードをメッセージにして投げる */
export const uploadReceipt = async (
  expenseId: number,
  file: File,
): Promise<void> => {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`/api/expenses/${expenseId}/receipt`, {
    method: "PUT",
    body,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(
      `レシートを保存できませんでした（${String(data.error ?? res.status)}）`,
    );
  }
};
