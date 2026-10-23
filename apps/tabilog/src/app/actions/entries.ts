"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import {
  addPhotos,
  createEntry,
  deleteEntry,
  deletePhoto,
  getEntry,
  getPhoto,
  getTrip,
  setCoverPhoto,
  listEntryPhotoKeys,
  updateEntry,
} from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { toWallClock } from "@/lib/datetime";
import { ENTRY_KINDS } from "@/lib/entry-kinds";
import {
  type ActionState,
  idFromForm,
  optionalIdFromForm,
  optionalText,
  parseForm,
} from "@/lib/form";
import { MAP_URL_EXAMPLE, normalizeMapUrl } from "@/lib/map-url";
import {
  DEFAULT_CURRENCY,
  normalizeCurrency,
  parseAmountToMinor,
} from "@/lib/money";
import { deletePhotos, storePhotos } from "@/lib/photos";

const entrySchema = z.object({
  id: optionalIdFromForm,
  tripId: idFromForm,
  kind: z.enum(ENTRY_KINDS),
  title: z
    .string()
    .trim()
    .min(1, "何を食べた・買ったかを入力してください")
    .max(200, "タイトルが長すぎます"),
  place: optionalText(200),
  /** Google マップの URL（任意）。形は後段で検証する */
  mapUrl: optionalText(2000),
  /** 通貨ごとの桁数が要るので、ここでは文字列のまま受けて後段で最小単位に直す */
  amount: optionalText(30),
  /** 金額をどの通貨で入力したか。旅行に登録された通貨か円のみ受け付ける */
  amountCurrency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "通貨コードは 3 文字で入力してください")
    .default(DEFAULT_CURRENCY),
  /** どのエリアの記録か。0 または空は「指定しない」 */
  areaId: z.coerce.number().int().min(0).default(0),
  /** 0 は「未評価」 */
  rating: z.coerce.number().int().min(0).max(5).default(0),
  note: optionalText(2000),
  happenedAt: z.string().trim().min(1, "日時を入力してください"),
});

export async function saveEntry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(entrySchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const {
    id,
    tripId,
    amount,
    amountCurrency,
    areaId,
    rating,
    happenedAt,
    mapUrl,
    ...rest
  } = parsed.data;

  const wallClock = toWallClock(happenedAt);
  if (!wallClock) return { error: "日時の形式が不正です" };

  // リンクとして出すので、Google マップの URL 以外は入れさせない
  let normalizedMapUrl: string | undefined;
  if (mapUrl !== undefined) {
    const normalized = normalizeMapUrl(mapUrl);
    if (!normalized)
      return {
        error: `Google マップの URL を貼ってください（例: ${MAP_URL_EXAMPLE}）`,
      };
    normalizedMapUrl = normalized;
  }

  const db = await getDb();
  const trip = await getTrip(db, tripId);
  if (!trip) return { error: "旅行が見つかりません" };

  // 現地で払ったか日本円で払ったかは記録ごとに変わるので、入力通貨も一緒に残す。
  // 円はどの旅行でも使えるが、現地通貨は旅行に登録されたものだけ
  const currency = normalizeCurrency(amountCurrency);
  if (
    currency !== DEFAULT_CURRENCY &&
    !trip.currencies.some((c) => c.code === currency)
  ) {
    return { error: "この旅行で使えない通貨です" };
  }

  let amountMinor: number | undefined;
  if (amount !== undefined) {
    const minor = parseAmountToMinor(amount, currency);
    if (minor === null)
      return { error: "金額は 0 以上の数値で入力してください" };
    amountMinor = minor;
  }

  // 他の旅行のエリアを指されないよう、この旅行のものか確かめる
  if (areaId !== 0 && !trip.areas.some((a) => a.id === areaId)) {
    return { error: "この旅行にないエリアです" };
  }

  const input = {
    ...rest,
    areaId: areaId === 0 ? undefined : areaId,
    mapUrl: normalizedMapUrl,
    amountMinor,
    amountCurrency: amountMinor === undefined ? undefined : currency,
    rating: rating === 0 ? undefined : rating,
    happenedAt: wallClock,
  };

  // FormData から直接取るのは、複数ファイルが Zod のスキーマに乗らないため
  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File);

  let entryId = id;
  try {
    if (entryId) {
      const existing = await getEntry(db, entryId);
      if (!existing || existing.tripId !== tripId)
        return { error: "記録が見つかりません" };
      await updateEntry(db, entryId, input);
    } else {
      const created = await createEntry(db, tripId, input, user.id);
      entryId = created.id;
    }
    const stored = await storePhotos(files, tripId);
    if (stored.length > 0) await addPhotos(db, entryId, stored);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "保存に失敗しました" };
  }

  revalidatePath("/");
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/entries/${entryId}`);
  redirect(`/trips/${tripId}/entries/${entryId}`);
}

export async function deleteEntryAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = idFromForm.safeParse(formData.get("id"));
  const tripId = idFromForm.safeParse(formData.get("tripId"));
  if (!id.success || !tripId.success) throw new Error("ID が不正です");

  const db = await getDb();
  const keys = await listEntryPhotoKeys(db, id.data);
  await deleteEntry(db, id.data);
  await deletePhotos(keys);

  revalidatePath("/");
  revalidatePath(`/trips/${tripId.data}`);
  redirect(`/trips/${tripId.data}`);
}

/** 一覧に出すサムネイルを、この写真に差し替える */
export async function setCoverPhotoAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = idFromForm.safeParse(formData.get("id"));
  if (!id.success) throw new Error("写真 ID が不正です");

  const db = await getDb();
  const photo = await getPhoto(db, id.data);
  if (!photo) return;
  await setCoverPhoto(db, photo.id);

  const entry = await getEntry(db, photo.entryId);
  if (entry) {
    revalidatePath("/");
    revalidatePath(`/trips/${entry.tripId}`);
    revalidatePath(`/trips/${entry.tripId}/entries/${entry.id}`);
  }
}

export async function deletePhotoAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = idFromForm.safeParse(formData.get("id"));
  if (!id.success) throw new Error("写真 ID が不正です");

  const db = await getDb();
  const photo = await getPhoto(db, id.data);
  if (!photo) return;
  await deletePhoto(db, photo.id);
  await deletePhotos([photo.key]);

  const entry = await getEntry(db, photo.entryId);
  if (entry) {
    revalidatePath(`/trips/${entry.tripId}`);
    revalidatePath(`/trips/${entry.tripId}/entries/${entry.id}`);
  }
}
