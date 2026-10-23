"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  createComment,
  deleteComment,
  getComment,
  getEntry,
} from "@/db/queries";
import { requireUser } from "@/lib/auth";
import {
  type ActionState,
  idFromForm,
  optionalIdFromForm,
  parseForm,
} from "@/lib/form";

const commentSchema = z.object({
  entryId: idFromForm,
  parentId: optionalIdFromForm,
  body: z
    .string()
    .trim()
    .min(1, "コメントを入力してください")
    .max(2000, "コメントが長すぎます"),
});

export async function addComment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(commentSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { entryId, parentId, body } = parsed.data;

  const db = await getDb();
  const entry = await getEntry(db, entryId);
  if (!entry) return { error: "記録が見つかりません" };

  // 返信先が別の記録のコメントなら、ただのトップレベル投稿として扱う
  let validParentId: number | undefined;
  if (parentId) {
    const parent = await getComment(db, parentId);
    if (parent && parent.entryId === entryId) validParentId = parent.id;
  }

  await createComment(db, { entryId, parentId: validParentId, body }, user.id);

  revalidatePath(`/trips/${entry.tripId}`);
  revalidatePath(`/trips/${entry.tripId}/entries/${entryId}`);
  return { success: "コメントを投稿しました" };
}

export async function deleteCommentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idFromForm.safeParse(formData.get("id"));
  if (!id.success) throw new Error("コメント ID が不正です");

  const db = await getDb();
  const comment = await getComment(db, id.data);
  if (!comment) return;
  // 自分のコメントだけ消せる
  if (comment.authorId !== user.id)
    throw new Error("他の人のコメントは削除できません");

  await deleteComment(db, comment.id);

  const entry = await getEntry(db, comment.entryId);
  if (entry) {
    revalidatePath(`/trips/${entry.tripId}`);
    revalidatePath(`/trips/${entry.tripId}/entries/${entry.id}`);
  }
}
