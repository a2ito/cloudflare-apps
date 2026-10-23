/**
 * 写真の受け入れ条件。サーバ（R2 への保存）とクライアント（送信前の縮小）の
 * 両方で使うため、Cloudflare の env に触れないここに置く。
 */

/** 1 枚あたりの上限。これを超えるものは保存しない */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** 1 つの記録に一度に付けられる枚数 */
export const MAX_PHOTOS_PER_ENTRY = 8;

/** 保存できる画像の MIME タイプ */
export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export function isAllowedPhotoType(type: string): boolean {
  return (ALLOWED_PHOTO_TYPES as readonly string[]).includes(type);
}

/** エラー文に出すための、人が読めるサイズ表記 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}
