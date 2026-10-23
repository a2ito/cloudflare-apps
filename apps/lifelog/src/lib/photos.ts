import { extensionForType } from "./clipboard";
import { getEnv } from "./cloudflare";
import {
  formatBytes,
  isAllowedPhotoType,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_ENTRY,
} from "./photo-limits";

/** 写真の置き場所。/api/photos はこの接頭辞の外を辿らせない */
export const PHOTO_KEY_PREFIX = "entries/";

export type StoredPhoto = { key: string; contentType: string };

/** 中身の無い file input（何も選ばずに送信したとき）を除く */
export function nonEmptyFiles(files: readonly File[]): File[] {
  return files.filter((f) => f.size > 0);
}

/**
 * 保存してよい写真か。日記を書き込む前に確かめるため、R2 に触れずに判定する
 * （写真が駄目なのに本文だけ保存されると、送り直したときに同じ日記が 2 件になる）。
 *
 * @param existing その日記にすでに付いている枚数
 */
export function validatePhotos(
  files: readonly File[],
  existing = 0,
): string | null {
  if (existing + files.length > MAX_PHOTOS_PER_ENTRY) {
    const room = Math.max(0, MAX_PHOTOS_PER_ENTRY - existing);
    return room === 0
      ? `写真は 1 件に ${MAX_PHOTOS_PER_ENTRY} 枚までです。先に不要な写真を削除してください`
      : `写真は 1 件に ${MAX_PHOTOS_PER_ENTRY} 枚までです（あと ${room} 枚）`;
  }
  for (const file of files) {
    if (!isAllowedPhotoType(file.type))
      return `対応していない画像形式です: ${file.type || "不明"}`;
    if (file.size > MAX_PHOTO_BYTES)
      return `画像サイズは ${formatBytes(MAX_PHOTO_BYTES)} 以下にしてください`;
  }
  return null;
}

/** 写真を R2 に保存してキーを返す。呼ぶ前に validatePhotos で確かめておくこと */
export async function storePhotos(
  files: readonly File[],
  entryId: number,
): Promise<StoredPhoto[]> {
  if (files.length === 0) return [];
  const env = await getEnv();
  const stored: StoredPhoto[] = [];
  for (const file of files) {
    const key = `${PHOTO_KEY_PREFIX}${entryId}/${crypto.randomUUID()}.${extensionForType(file.type)}`;
    await env.PHOTOS_BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });
    stored.push({ key, contentType: file.type });
  }
  return stored;
}

export async function deletePhotos(keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  const env = await getEnv();
  await env.PHOTOS_BUCKET.delete([...keys]);
}

/**
 * 写真の配信 URL。
 *
 * sakelog などは R2 のカスタムドメインから CDN が直に返すが、そうすると URL を
 * 知っていれば誰でも取得できる。日記の写真は私的なので、必ず /api/photos を通して
 * 持ち主かどうかを確かめる。利用者は 1 人なので、写真ごとに Worker が起動しても
 * 負荷は問題にならない。
 */
export function photoUrl(key: string): string {
  return `/api/photos/${key}`;
}
