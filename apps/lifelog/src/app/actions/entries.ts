"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import {
  addPhotos,
  createEntry,
  deleteEntry,
  deletePhotoRow,
  getEntry,
  getOwnedPhoto,
  updateEntry,
} from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { toWallClock } from "@/lib/datetime";
import {
  type ActionState,
  idFromForm,
  optionalIdFromForm,
  parseForm,
} from "@/lib/form";
import { MAX_BODY_LENGTH } from "@/lib/limits";
import {
  deletePhotos,
  nonEmptyFiles,
  storePhotos,
  validatePhotos,
} from "@/lib/photos";

const entrySchema = z.object({
  id: optionalIdFromForm,
  happenedAt: z.string(),
  body: z
    .string()
    .trim()
    .max(
      MAX_BODY_LENGTH,
      `本文は ${MAX_BODY_LENGTH.toLocaleString("ja-JP")} 文字までです`,
    ),
});

export async function saveEntry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(entrySchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { id, body } = parsed.data;

  const happenedAt = toWallClock(parsed.data.happenedAt);
  if (!happenedAt) return { error: "日時の形式が不正です" };

  // FormData から直接取るのは、複数ファイルが Zod のスキーマに乗らないため
  const files = nonEmptyFiles(
    formData.getAll("photos").filter((f): f is File => f instanceof File),
  );

  const db = await getDb();
  const existing = id ? await getEntry(db, user.id, id) : null;
  if (id && !existing) return { error: "日記が見つかりません" };

  // 写真だけの日もあるので、本文か写真のどちらかがあればよい
  const photoCount = (existing?.photos.length ?? 0) + files.length;
  if (body === "" && photoCount === 0)
    return { error: "本文か写真のどちらかを入れてください" };

  // 日記を書き込む前に写真を確かめる。写真で失敗したのに本文だけ保存されると、
  // 送り直したときに同じ日記が 2 件になる
  const photoError = validatePhotos(files, existing?.photos.length ?? 0);
  if (photoError) return { error: photoError };

  let entryId: number;
  try {
    if (existing) {
      await updateEntry(db, user.id, existing.id, { happenedAt, body });
      entryId = existing.id;
    } else {
      entryId = (await createEntry(db, user.id, { happenedAt, body })).id;
    }
    const stored = await storePhotos(files, entryId);
    await addPhotos(db, entryId, stored);
  } catch (e) {
    console.error("日記の保存に失敗しました", e);
    return { error: e instanceof Error ? e.message : "保存に失敗しました" };
  }

  revalidatePath("/");
  revalidatePath(`/entries/${entryId}`);
  redirect(`/entries/${entryId}`);
}

export async function deleteEntryAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idFromForm.safeParse(formData.get("id"));
  if (!id.success) throw new Error("ID が不正です");

  const db = await getDb();
  const keys = await deleteEntry(db, user.id, id.data);
  // 外部キーの cascade では R2 の実体は消えないので、ここでまとめて消す
  if (keys) await deletePhotos(keys);

  revalidatePath("/");
  redirect("/");
}

export async function deletePhotoAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idFromForm.safeParse(formData.get("id"));
  if (!id.success) throw new Error("写真 ID が不正です");

  const db = await getDb();
  const photo = await getOwnedPhoto(db, user.id, id.data);
  if (!photo) return;
  await deletePhotoRow(db, photo.id);
  await deletePhotos([photo.key]);

  revalidatePath("/");
  revalidatePath(`/entries/${photo.entryId}`);
}
