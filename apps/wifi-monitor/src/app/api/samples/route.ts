import { getDb } from "@/db";
import { readBodyWithLimit } from "@/lib/body";
import { authenticateDevice, ingestSamples } from "@/lib/ingest";
import { MAX_REQUEST_BYTES } from "@/lib/limits";

/**
 * エージェントから計測値を受け取る。認証は端末のトークン（Authorization: Bearer）。
 * 本文は認証が通ってから、上限つきで読む。
 */
export async function POST(request: Request): Promise<Response> {
  const db = await getDb();
  const auth = await authenticateDevice(
    db,
    request.headers.get("authorization"),
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const text = await readBodyWithLimit(request, MAX_REQUEST_BYTES);
  if (text === null) {
    return Response.json(
      { error: `本文が大きすぎます（上限 ${MAX_REQUEST_BYTES} バイト）` },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json(
      { error: "本文が JSON として読めません" },
      { status: 400 },
    );
  }

  const result = await ingestSamples(db, {
    device: auth.device,
    body,
    now: new Date(),
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ accepted: result.accepted, skipped: result.skipped });
}
