import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { expenses } from "@/db/schema";
import { authorize, type AuthorizedContext } from "@/lib/apiAuth";
import { receiptKey, validateReceipt } from "@/lib/receipt";

const parseId = async (params: Promise<{ id: string }>) => {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** 自グループの明細だけを返す。他グループの明細は存在しないものとして扱う */
const findExpense = ({ db, groupId }: AuthorizedContext, expenseId: number) =>
  db
    .select({ id: expenses.id, receiptKey: expenses.receiptKey })
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)))
    .get();

const notFound = () =>
  NextResponse.json({ error: "expense-not-found" }, { status: 404 });

/**
 * レシート画像を返す。レシートは店名や買った物が分かるため公開ドメインには置かず、
 * 毎回ここで所属グループを確かめてから R2 から読む
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;

  const id = await parseId(params);
  if (id === null) return notFound();

  const expense = await findExpense(auth, id);
  if (!expense?.receiptKey) return notFound();

  const { env } = getCloudflareContext();
  const object = await env.RECEIPTS_BUCKET.get(expense.receiptKey, {
    onlyIf: request.headers,
  });
  if (!object) return notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  // 差し替えても URL は変わらないので、毎回 etag で確かめさせる
  headers.set("cache-control", "private, no-cache");

  // onlyIf の条件に合わなかった（If-None-Match が一致した）ときは本文が無い
  if (!("body" in object)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(object.body, { headers });
}

/** レシートを付ける。既に付いていれば差し替えて、古い画像を消す */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;

  const id = await parseId(params);
  if (id === null) return notFound();

  const expense = await findExpense(auth, id);
  if (!expense) return notFound();

  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file-required" }, { status: 400 });
  }

  const validation = validateReceipt(file);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  const key = receiptKey(auth.groupId, id, validation.contentType);
  await env.RECEIPTS_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: validation.contentType },
  });

  try {
    await auth.db
      .update(expenses)
      .set({ receiptKey: key })
      .where(and(eq(expenses.id, id), eq(expenses.groupId, auth.groupId)));
  } catch (err) {
    // 明細に紐付かなかった画像を残さない
    await env.RECEIPTS_BUCKET.delete(key);
    throw err;
  }

  if (expense.receiptKey) {
    await env.RECEIPTS_BUCKET.delete(expense.receiptKey);
  }

  return NextResponse.json({ ok: true });
}

/** レシートを外して画像を消す */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;

  const id = await parseId(params);
  if (id === null) return notFound();

  const expense = await findExpense(auth, id);
  if (!expense) return notFound();
  if (!expense.receiptKey) return NextResponse.json({ ok: true });

  await auth.db
    .update(expenses)
    .set({ receiptKey: null })
    .where(and(eq(expenses.id, id), eq(expenses.groupId, auth.groupId)));

  const { env } = getCloudflareContext();
  await env.RECEIPTS_BUCKET.delete(expense.receiptKey);

  return NextResponse.json({ ok: true });
}
