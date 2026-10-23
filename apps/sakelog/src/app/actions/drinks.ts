"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import {
  addPhotos,
  createDrink,
  deleteDrink,
  deletePhoto,
  getDrink,
  getPhoto,
  listDrinkPhotoKeys,
  setCoverPhoto,
  updateDrink,
  type DrinkInput,
  type SpecificValues,
} from "@/db/queries";
import { requireUser } from "@/lib/auth";
import {
  allowsField,
  CATEGORIES,
  categoryDef,
  SPECIFIC_FIELD_KEYS,
  SPECIFIC_FIELDS,
} from "@/lib/categories";
import { MIN_YEAR, maxYear, toDate } from "@/lib/datetime";
import {
  type ActionState,
  idFromForm,
  optionalIdFromForm,
  optionalText,
  parseForm,
} from "@/lib/form";
import { parseIngredients } from "@/lib/ingredients";
import {
  DEFAULT_CURRENCY,
  normalizeCurrency,
  parseAmountToMinor,
} from "@/lib/money";
import { deletePhotos, storePhotos } from "@/lib/photos";
import { MAX_RATING, toRatingValue } from "@/lib/ratings";
import { normalizeShopUrl, SHOP_URL_EXAMPLE } from "@/lib/shop-url";

/** 0 は「未評価」。フォームの select がその値を送ってくる */
const ratingFromForm = z.coerce
  .number()
  .int()
  .min(0)
  .max(MAX_RATING)
  .default(0);

const drinkSchema = z.object({
  id: optionalIdFromForm,
  name: z
    .string()
    .trim()
    .min(1, "銘柄を入力してください")
    .max(200, "銘柄が長すぎます"),
  maker: optionalText(200),
  category: z.enum(CATEGORIES),
  style: optionalText(100),
  /** 空欄は「不明・年表記なし」。範囲は後段で見る */
  year: optionalText(4),
  /** アルコール度数。範囲は後段で見る */
  abv: optionalText(10),
  country: optionalText(100),
  region: optionalText(100),
  /** 材料はカンマ区切りで受ける。1 本に何種類も入るため */
  ingredients: optionalText(600),
  /** 通貨ごとの桁数が要るので、ここでは文字列のまま受けて後段で最小単位に直す */
  price: optionalText(30),
  priceCurrency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "通貨コードは 3 文字で入力してください")
    .default(DEFAULT_CURRENCY),
  shop: optionalText(200),
  shopUrl: optionalText(2000),
  /** 空欄は「まだ飲んでいない」 */
  drunkAt: optionalText(10),
  ratingOverall: ratingFromForm,
  ratingAroma: ratingFromForm,
  ratingTaste: ratingFromForm,
  ratingFinish: ratingFromForm,
  ratingValue: ratingFromForm,
  note: optionalText(2000),
});

/**
 * 種類ごとの項目を取り出す。
 *
 * その種類で意味を持たない項目は、フォームに出していなくても送られうるので捨てる
 * （ビールの記録に精米歩合が残っていると、あとから見て何の値か分からなくなる）。
 */
function readSpecifics(
  category: string,
  formData: FormData,
): { ok: true; values: SpecificValues } | { ok: false; error: string } {
  const values: SpecificValues = {};

  for (const key of SPECIFIC_FIELD_KEYS) {
    if (!allowsField(category, key)) continue;
    const raw = formData.get(key);
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text === "") continue;

    const def = SPECIFIC_FIELDS[key];
    if (def.kind === "text") {
      values[key] = text.slice(0, 100);
      continue;
    }
    if (def.kind === "choice") {
      if (!(def.choices as readonly string[]).includes(text)) {
        return { ok: false, error: `${def.label}に入れられない値です` };
      }
      values[key] = text;
      continue;
    }

    // 日本酒度は "+3" のように符号付きで書かれる
    const num = Number(text.replace(/^\+/, ""));
    if (!Number.isFinite(num))
      return { ok: false, error: `${def.label}は数値で入力してください` };
    if (def.kind === "integer" && !Number.isInteger(num)) {
      return { ok: false, error: `${def.label}は整数で入力してください` };
    }
    if (num < def.min || num > def.max) {
      return {
        ok: false,
        error: `${def.label}は ${def.min} 〜 ${def.max} で入力してください`,
      };
    }
    values[key] = num;
  }

  return { ok: true, values };
}

export async function saveDrink(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(drinkSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const {
    id,
    category,
    style,
    year,
    abv,
    ingredients,
    price,
    priceCurrency,
    shopUrl,
    drunkAt,
    ...rest
  } = parsed.data;

  const def = categoryDef(category);

  // 年を持たない種類（ビールなど）に年が残っていると、あとから見て何の年か分からない
  let yearValue: number | undefined;
  if (year !== undefined && def.yearLabel) {
    const parsedYear = Number(year);
    if (
      !Number.isInteger(parsedYear) ||
      parsedYear < MIN_YEAR ||
      parsedYear > maxYear()
    ) {
      return {
        error: `${def.yearLabel}は ${MIN_YEAR} 〜 ${maxYear()} で入力してください`,
      };
    }
    yearValue = parsedYear;
  }

  let abvValue: number | undefined;
  if (abv !== undefined) {
    const parsedAbv = Number(abv);
    if (!Number.isFinite(parsedAbv) || parsedAbv < 0 || parsedAbv > 100) {
      return { error: "度数は 0 〜 100 で入力してください" };
    }
    abvValue = parsedAbv;
  }

  const specifics = readSpecifics(category, formData);
  if (!specifics.ok) return { error: specifics.error };

  // リンクとして出すので、https の URL 以外は入れさせない
  let normalizedShopUrl: string | undefined;
  if (shopUrl !== undefined) {
    const normalized = normalizeShopUrl(shopUrl);
    if (!normalized)
      return {
        error: `店の URL は https で入力してください（例: ${SHOP_URL_EXAMPLE}）`,
      };
    normalizedShopUrl = normalized;
  }

  const currency = normalizeCurrency(priceCurrency);
  let priceMinor: number | undefined;
  if (price !== undefined) {
    const minor = parseAmountToMinor(price, currency);
    if (minor === null)
      return { error: "価格は 0 以上の数値で入力してください" };
    priceMinor = minor;
  }

  let drunkOn: string | undefined;
  if (drunkAt !== undefined) {
    const date = toDate(drunkAt);
    if (!date) return { error: "飲んだ日の形式が不正です" };
    drunkOn = date;
  }

  const input: DrinkInput = {
    ...rest,
    category,
    style,
    year: yearValue,
    abv: abvValue,
    ingredients: parseIngredients(ingredients),
    specifics: specifics.values,
    priceMinor,
    // 価格が無いのに通貨だけ残ると、あとから見て意味の無い値になる
    priceCurrency: priceMinor === undefined ? undefined : currency,
    shopUrl: normalizedShopUrl,
    drunkAt: drunkOn,
    ratingOverall: toRatingValue(rest.ratingOverall) ?? undefined,
    ratingAroma: toRatingValue(rest.ratingAroma) ?? undefined,
    ratingTaste: toRatingValue(rest.ratingTaste) ?? undefined,
    ratingFinish: toRatingValue(rest.ratingFinish) ?? undefined,
    ratingValue: toRatingValue(rest.ratingValue) ?? undefined,
  };

  // FormData から直接取るのは、複数ファイルが Zod のスキーマに乗らないため
  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File);

  const db = await getDb();
  let drinkId = id;
  try {
    if (drinkId) {
      const existing = await getDrink(db, drinkId);
      if (!existing) return { error: "記録が見つかりません" };
      await updateDrink(db, drinkId, input);
    } else {
      const created = await createDrink(db, input, user.id);
      drinkId = created.id;
    }
    const stored = await storePhotos(files, drinkId);
    if (stored.length > 0) await addPhotos(db, drinkId, stored);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "保存に失敗しました" };
  }

  revalidatePath("/");
  revalidatePath(`/drinks/${drinkId}`);
  redirect(`/drinks/${drinkId}`);
}

export async function deleteDrinkAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = idFromForm.safeParse(formData.get("id"));
  if (!id.success) throw new Error("ID が不正です");

  const db = await getDb();
  const keys = await listDrinkPhotoKeys(db, id.data);
  await deleteDrink(db, id.data);
  // 外部キーの cascade では R2 の実体は消えないので、ここでまとめて消す
  await deletePhotos(keys);

  revalidatePath("/");
  redirect("/");
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

  revalidatePath("/");
  revalidatePath(`/drinks/${photo.drinkId}`);
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

  revalidatePath("/");
  revalidatePath(`/drinks/${photo.drinkId}`);
}
