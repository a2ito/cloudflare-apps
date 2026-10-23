import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { getOwnedPhotoByKey } from "@/db/queries";
import { currentUserId } from "@/lib/auth";
import { getEnv } from "@/lib/cloudflare";
import { PHOTO_KEY_PREFIX } from "@/lib/photos";

/**
 * 日記の写真を返す。R2 を公開せず、ここで持ち主かどうかを確かめる
 * （src/lib/photos.ts の photoUrl を参照）。
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/photos/[...key]">,
) {
  const userId = await currentUserId();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { key } = await ctx.params;
  const objectKey = key.join("/");
  // バケット内の想定外のパスは辿らせない
  if (!objectKey.startsWith(PHOTO_KEY_PREFIX))
    return new NextResponse("Not Found", { status: 404 });

  // 他人の写真は、あるかどうかも知らせないよう 404 にそろえる
  const db = await getDb();
  const photo = await getOwnedPhotoByKey(db, userId, objectKey);
  if (!photo) return new NextResponse("Not Found", { status: 404 });

  const env = await getEnv();
  const object = await env.PHOTOS_BUCKET.get(objectKey);
  if (!object) return new NextResponse("Not Found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  // キーは UUID で中身は入れ替わらないので長く持たせてよい。ただし共有キャッシュには載せない
  headers.set("cache-control", "private, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
