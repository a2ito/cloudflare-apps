"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import {
  createTrip,
  deleteTrip,
  getTrip,
  listTripPhotoKeys,
  updateTrip,
} from "@/db/queries";
import { requireUser } from "@/lib/auth";
import {
  type ActionState,
  idFromForm,
  optionalIdFromForm,
  optionalText,
  parseForm,
} from "@/lib/form";
import {
  DEFAULT_CURRENCY,
  MAX_TRIP_CURRENCIES,
  normalizeCurrency,
} from "@/lib/money";
import { deletePhotos } from "@/lib/photos";
import { MAX_TRIP_AREAS } from "@/lib/trip-areas";

const optionalDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日付の形式が不正です")
    .optional(),
);

const tripSchema = z
  .object({
    id: optionalIdFromForm,
    name: z
      .string()
      .trim()
      .min(1, "旅行名を入力してください")
      .max(100, "旅行名が長すぎます"),
    startDate: optionalDate,
    endDate: optionalDate,
    note: optionalText(1000),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: "終了日は開始日以降にしてください",
    path: ["endDate"],
  });

/** 通貨は行が増減するので、1 行 = (currencyCode, currencyRate) の組で受ける */
const currencyRowSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "通貨コードは 3 文字で入力してください"),
  rateToJpy: z.coerce
    .number()
    .positive("換算レートは 0 より大きい数を入力してください")
    .max(100000),
});

type CurrencyRows =
  | { ok: true; rows: { code: string; rateToJpy: number }[] }
  | { ok: false; error: string };

/**
 * 通貨の行を FormData から取り出す。
 * parseForm は同名フィールドを 1 つにまとめてしまうので、ここだけ別に読む。
 */
function parseCurrencyRows(formData: FormData): CurrencyRows {
  const codes = formData.getAll("currencyCode");
  const rates = formData.getAll("currencyRate");
  const rows: { code: string; rateToJpy: number }[] = [];
  const seen = new Set<string>();

  for (const [i, rawCode] of codes.entries()) {
    // コードが空の行は「まだ選んでいない行」なので無視する
    if (typeof rawCode !== "string" || rawCode.trim() === "") continue;
    const parsed = currencyRowSchema.safeParse({
      code: rawCode,
      rateToJpy: rates[i] ?? "",
    });
    if (!parsed.success)
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "通貨の指定が不正です",
      };

    const code = normalizeCurrency(parsed.data.code);
    // 円は主通貨として常に使えるので保存しない
    if (code === DEFAULT_CURRENCY) continue;
    if (seen.has(code))
      return { ok: false, error: `通貨 ${code} が重複しています` };
    seen.add(code);
    rows.push({ code, rateToJpy: parsed.data.rateToJpy });
  }

  if (rows.length > MAX_TRIP_CURRENCIES) {
    return {
      ok: false,
      error: `通貨は ${MAX_TRIP_CURRENCIES} 個まで登録できます`,
    };
  }
  return { ok: true, rows };
}

/** エリアは 1 行 1 つ。空行と重複は落とし、並べた順を保つ */
function parseAreas(
  formData: FormData,
): { ok: true; names: string[] } | { ok: false; error: string } {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const raw of formData.getAll("areaName")) {
    if (typeof raw !== "string") continue;
    const name = raw.trim();
    if (name === "") continue;
    if (name.length > 50) return { ok: false, error: "エリア名が長すぎます" };
    // 同じ名前を 2 つ持てない（記録の指し先が曖昧になる）
    if (seen.has(name))
      return { ok: false, error: `エリア ${name} が重複しています` };
    seen.add(name);
    names.push(name);
  }

  if (names.length > MAX_TRIP_AREAS)
    return {
      ok: false,
      error: `エリアは ${MAX_TRIP_AREAS} 個まで登録できます`,
    };
  return { ok: true, names };
}

export async function saveTrip(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(tripSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const currencies = parseCurrencyRows(formData);
  if (!currencies.ok) return { error: currencies.error };

  const areas = parseAreas(formData);
  if (!areas.ok) return { error: areas.error };

  const { id, ...input } = parsed.data;
  const values = { ...input, currencies: currencies.rows, areas: areas.names };

  const db = await getDb();
  let tripId = id;
  if (tripId) {
    const existing = await getTrip(db, tripId);
    if (!existing) return { error: "旅行が見つかりません" };
    await updateTrip(db, tripId, values);
  } else {
    const created = await createTrip(db, values, user.id);
    tripId = created.id;
  }

  revalidatePath("/");
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

export async function deleteTripAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = idFromForm.safeParse(formData.get("id"));
  if (!id.success) throw new Error("旅行 ID が不正です");

  const db = await getDb();
  // R2 の実体は外部キーの cascade では消えないので、先にキーを集めて削除する
  const keys = await listTripPhotoKeys(db, id.data);
  await deleteTrip(db, id.data);
  await deletePhotos(keys);

  revalidatePath("/");
  redirect("/");
}
