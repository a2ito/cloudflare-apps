import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/cloudflare";

/**
 * 開発用の画像配信。本番は R2 のカスタムドメインから CDN が直に返すため、この経路は
 * 使われない（src/lib/images.ts の imageUrl を参照）。手元では Miniflare のローカル
 * R2 に入った画像をカスタムドメインから取れないので、その代わりにここが受ける。
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/images/[...key]">) {
	const session = await auth();
	if (!session?.user?.email) return new NextResponse("Unauthorized", { status: 401 });

	const { key } = await ctx.params;
	const objectKey = key.join("/");
	if (!objectKey.startsWith("products/")) return new NextResponse("Not Found", { status: 404 });

	const env = await getEnv();
	const object = await env.IMAGES_BUCKET.get(objectKey);
	if (!object) return new NextResponse("Not Found", { status: 404 });

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("etag", object.httpEtag);
	headers.set("cache-control", "private, max-age=86400");
	return new Response(object.body, { headers });
}
