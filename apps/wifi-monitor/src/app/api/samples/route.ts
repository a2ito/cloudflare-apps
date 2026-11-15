import { getDb } from "@/db";
import { ingestSamples } from "@/lib/ingest";
import { MAX_REQUEST_BYTES } from "@/lib/limits";

/** エージェントから計測値を受け取る。認証は端末のトークン（Authorization: Bearer） */
export async function POST(request: Request): Promise<Response> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_REQUEST_BYTES) {
    return Response.json(
      { error: `本文が大きすぎます（上限 ${MAX_REQUEST_BYTES} バイト）` },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "本文が JSON として読めません" },
      { status: 400 },
    );
  }

  const result = await ingestSamples(await getDb(), {
    authorization: request.headers.get("authorization"),
    body,
    now: new Date(),
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(
    { accepted: result.accepted, skipped: result.skipped },
    { status: 200 },
  );
}
