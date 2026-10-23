import { getEnv } from "./cloudflare";
import {
  isAllowedPhotoType,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_DRINK,
} from "./photo-limits";

const CACHE_CONTROL = "public, max-age=31536000, immutable";
export const PHOTO_LIMITS = {
  maxBytes: MAX_PHOTO_BYTES,
  maxCount: MAX_PHOTOS_PER_DRINK,
} as const;

function extensionFor(type: string): string {
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

export type StoredPhoto = { key: string; contentType: string };

/** FormData から取り出した写真を R2 に保存してキーを返す。中身の無いファイルは無視する */
export async function storePhotos(
  files: readonly File[],
  drinkId: number,
): Promise<StoredPhoto[]> {
  const targets = files.filter((f) => f && f.size > 0);
  if (targets.length === 0) return [];
  if (targets.length > MAX_PHOTOS_PER_DRINK) {
    throw new Error(`写真は一度に ${MAX_PHOTOS_PER_DRINK} 枚までです`);
  }
  for (const file of targets) {
    if (!isAllowedPhotoType(file.type))
      throw new Error(`対応していない画像形式です: ${file.type || "不明"}`);
    if (file.size > MAX_PHOTO_BYTES)
      throw new Error("画像サイズは 5MB 以下にしてください");
  }

  const env = await getEnv();
  const stored: StoredPhoto[] = [];
  for (const file of targets) {
    const key = `drinks/${drinkId}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
    await env.PHOTOS_BUCKET.put(key, await file.arrayBuffer(), {
      // キーは UUID で、同じキーの中身が入れ替わることはない。CDN とブラウザに
      // 恒久的にキャッシュさせてよい。
      httpMetadata: { contentType: file.type, cacheControl: CACHE_CONTROL },
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
 * 写真の配信 URL。R2 のカスタムドメインを直に指すので Worker を経由しない。
 *
 * Route Handler (/api/photos) 経由だと写真 1 枚につき Worker が 1 回起動し、その
 * すべてで Auth.js のセッション復号が走る。CDN から直に返せば Worker は起動しない。
 *
 * 引き換えに、写真は URL を知っていれば認証なしで取得できる。キーが UUID v4 で
 * 推測できないことに依存している。バケットの一覧は公開されないため列挙もできない。
 * 記録の中身は D1 にあり、今まで通り認証の内側にある。
 *
 * 基底 URL が無いときは /api/photos へ落とす。手元では写真が Miniflare のローカル
 * R2 に入り、カスタムドメインからは取れないためこの経路が要る。本番でも渡し忘れた
 * ときは CPU 削減が効かないだけで写真は出る。
 */
export function photoUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_PHOTOS_BASE_URL;
  if (base) return `${base.replace(/\/+$/, "")}/${key}`;
  return `/api/photos/${key}`;
}
