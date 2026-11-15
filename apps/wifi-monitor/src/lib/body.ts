/**
 * 本文を上限つきで読む。超えたら途中で読むのをやめて null を返す。
 *
 * Content-Length だけを見ると、chunked 転送のようにヘッダが無い送信で上限を素通りされ、
 * request.json() が本文を丸ごとメモリに載せてしまう。実際に読んだ量で数える。
 */
export async function readBodyWithLimit(
  request: Request,
  maxBytes: number,
): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
