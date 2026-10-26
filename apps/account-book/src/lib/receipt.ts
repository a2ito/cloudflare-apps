// ブラウザ側で縮めてから送るので、通常はこの上限に届かない
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

const EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ReceiptContentType = keyof typeof EXTENSIONS;

const isReceiptContentType = (type: string): type is ReceiptContentType =>
  Object.hasOwn(EXTENSIONS, type);

export type ReceiptValidation =
  | { ok: true; contentType: ReceiptContentType }
  | { ok: false; error: "unsupported-type" | "empty" | "too-large" };

export const validateReceipt = (file: {
  type: string;
  size: number;
}): ReceiptValidation => {
  if (!isReceiptContentType(file.type)) {
    return { ok: false, error: "unsupported-type" };
  }
  if (file.size === 0) return { ok: false, error: "empty" };
  if (file.size > MAX_RECEIPT_BYTES) return { ok: false, error: "too-large" };
  return { ok: true, contentType: file.type };
};

/**
 * レシートの R2 キー。差し替えのたびに新しいキーにして、古い画像は呼び出し側で消す。
 * グループ ID を含めておくと、バケットを見たときにどのグループのものか分かる
 */
export const receiptKey = (
  groupId: string,
  expenseId: number,
  contentType: ReceiptContentType,
  uuid: string = crypto.randomUUID(),
): string =>
  `receipts/${groupId}/${expenseId}/${uuid}.${EXTENSIONS[contentType]}`;
