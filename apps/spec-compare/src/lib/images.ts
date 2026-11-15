import { getEnv } from "./cloudflare";

// imageUrl はクライアントコンポーネントからも読むため、cloudflare:workers を引き込まない
// 別のモジュールに置いている。サーバ側の呼び出し元とテストのためにここからも出す。
export { imageUrl } from "./image-url";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

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

/** FormData の画像を R2 に保存してキーを返す。画像が無ければ null */
export async function storeImage(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (!ALLOWED_TYPES.has(file.type))
    throw new Error(`対応していない画像形式です: ${file.type || "不明"}`);
  if (file.size > MAX_IMAGE_BYTES)
    throw new Error("画像サイズは 4MB 以下にしてください");

  const env = await getEnv();
  const key = `products/${crypto.randomUUID()}.${extensionFor(file.type)}`;
  await env.IMAGES_BUCKET.put(key, await file.arrayBuffer(), {
    // キーは UUID で、同じキーの中身が入れ替わることはない。CDN とブラウザに
    // 恒久的にキャッシュさせてよい。
    httpMetadata: { contentType: file.type, cacheControl: CACHE_CONTROL },
  });
  return key;
}

export async function deleteImage(key: string | null): Promise<void> {
  if (!key) return;
  const env = await getEnv();
  await env.IMAGES_BUCKET.delete(key);
}
