"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, type Db } from "@/db";
import { listFields } from "@/db/queries";
import { priceRecords, products, specValues } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/date";
import {
  idFromForm,
  optionalText,
  optionalUrl,
  parseForm,
  type ActionState,
} from "@/lib/form";
import { deleteImage, storeImage } from "@/lib/images";
import { parseSpecValues, type SpecValueInput } from "@/lib/spec-form";

const productSchema = z.object({
  name: z.string().trim().min(1, "商品名を入力してください").max(100),
  maker: optionalText,
  memo: optionalText,
});

/** 登録と同時に入れられる最初の価格。店舗と価格はそろって入れるか、そろって空にする */
const firstPriceSchema = z.object({
  store: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(100).optional(),
  ),
  price: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce
      .number()
      .int("価格は整数で入力してください")
      .positive("価格は 1 円以上で入力してください")
      .optional(),
  ),
  url: optionalUrl,
});

/** D1 は 1 文のバインド変数が 100 までなので、4 列の行は余裕を見て 20 行ずつに分けて入れる */
const SPEC_INSERT_CHUNK = 20;

function specRows(productId: number, values: readonly SpecValueInput[]) {
  const rows = values.map((v) => ({
    productId,
    fieldId: v.fieldId,
    valueNum: v.valueNum,
    valueText: v.valueText,
  }));
  const chunks = [];
  for (let i = 0; i < rows.length; i += SPEC_INSERT_CHUNK)
    chunks.push(rows.slice(i, i + SPEC_INSERT_CHUNK));
  return chunks;
}

/** 商品のスペック値を入れ替える。消してから入れ直すので、空欄にした項目は未入力に戻る */
async function replaceSpecs(
  db: Db,
  productId: number,
  values: readonly SpecValueInput[],
): Promise<void> {
  const inserts = specRows(productId, values).map((chunk) =>
    db.insert(specValues).values(chunk),
  );
  await db.batch([
    db.delete(specValues).where(eq(specValues.productId, productId)),
    ...inserts,
  ]);
}

function imageFile(formData: FormData): File | null {
  const value = formData.get("image");
  return value instanceof File ? value : null;
}

export async function createProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = parseForm(
    productSchema.extend({ categoryId: idFromForm, ...firstPriceSchema.shape }),
    formData,
  );
  if (!parsed.ok) return { error: parsed.error };
  const { categoryId, store, price, url } = parsed.data;
  if ((store === undefined) !== (price === undefined))
    return { error: "最初の価格は、店舗と価格をそろえて入れてください" };

  const db = await getDb();
  const fields = await listFields(db, categoryId);
  const specs = parseSpecValues(fields, formData);
  if (!specs.ok) return { error: specs.error };

  let imageKey: string | null = null;
  try {
    imageKey = await storeImage(imageFile(formData));
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "画像の保存に失敗しました",
    };
  }

  const inserted = await db
    .insert(products)
    .values({
      categoryId,
      name: parsed.data.name,
      maker: parsed.data.maker ?? null,
      memo: parsed.data.memo ?? null,
      imageKey,
    })
    .returning({ id: products.id });
  const id = inserted[0]?.id;
  if (id === undefined) return { error: "商品の登録に失敗しました" };

  await replaceSpecs(db, id, specs.values);
  if (store !== undefined && price !== undefined) {
    await db.insert(priceRecords).values({
      productId: id,
      store,
      price,
      recordedAt: today(),
      url: url ?? null,
    });
  }

  revalidatePath(`/categories/${categoryId}`);
  revalidatePath("/");
  redirect(`/products/${id}`);
}

export async function updateProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = parseForm(
    productSchema.extend({
      id: idFromForm,
      removeImage: z.string().optional(),
    }),
    formData,
  );
  if (!parsed.ok) return { error: parsed.error };

  const db = await getDb();
  const current = (
    await db
      .select()
      .from(products)
      .where(eq(products.id, parsed.data.id))
      .limit(1)
  )[0];
  if (!current) return { error: "商品が見つかりません" };

  // 項目はカテゴリから引く。フォームに無い項目の値を送られても拾わない
  const fields = await listFields(db, current.categoryId);
  const specs = parseSpecValues(fields, formData);
  if (!specs.ok) return { error: specs.error };

  let imageKey = current.imageKey;
  try {
    const newKey = await storeImage(imageFile(formData));
    if (newKey) imageKey = newKey;
    else if (parsed.data.removeImage === "on") imageKey = null;
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "画像の保存に失敗しました",
    };
  }

  await db
    .update(products)
    .set({
      name: parsed.data.name,
      maker: parsed.data.maker ?? null,
      memo: parsed.data.memo ?? null,
      imageKey,
      updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
    })
    .where(eq(products.id, current.id));
  await replaceSpecs(db, current.id, specs.values);

  // 差し替えた画像は、DB が新しいキーを指してから消す。先に消すと失敗時に画像の無い商品が残る
  if (imageKey !== current.imageKey) await deleteImage(current.imageKey);

  revalidatePath(`/categories/${current.categoryId}`);
  revalidatePath(`/products/${current.id}`);
  redirect(`/products/${current.id}`);
}

/** お気に入りを付け外しする */
export async function setProductFavorite(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = parseForm(
    z.object({ id: idFromForm, favorite: z.enum(["0", "1"]) }),
    formData,
  );
  if (!parsed.ok) throw new Error(parsed.error);

  const db = await getDb();
  const updated = await db
    .update(products)
    .set({ favorite: parsed.data.favorite === "1" })
    .where(eq(products.id, parsed.data.id))
    .returning({ categoryId: products.categoryId });
  const categoryId = updated[0]?.categoryId;
  if (categoryId === undefined) throw new Error("商品が見つかりません");

  revalidatePath(`/categories/${categoryId}`);
  revalidatePath(`/products/${parsed.data.id}`);
}

/** 商品を比較表から隠す・戻す。消すと価格の記録まで失うので、候補から外すだけならこちらを使う */
export async function setProductHidden(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = parseForm(
    z.object({ id: idFromForm, hidden: z.enum(["0", "1"]) }),
    formData,
  );
  if (!parsed.ok) throw new Error(parsed.error);

  const db = await getDb();
  const updated = await db
    .update(products)
    .set({ hidden: parsed.data.hidden === "1" })
    .where(eq(products.id, parsed.data.id))
    .returning({ categoryId: products.categoryId });
  const categoryId = updated[0]?.categoryId;
  if (categoryId === undefined) throw new Error("商品が見つかりません");

  revalidatePath(`/categories/${categoryId}`);
  revalidatePath(`/products/${parsed.data.id}`);
}

export async function deleteProduct(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = parseForm(z.object({ id: idFromForm }), formData);
  if (!parsed.ok) throw new Error(parsed.error);

  const db = await getDb();
  const current = (
    await db
      .select()
      .from(products)
      .where(eq(products.id, parsed.data.id))
      .limit(1)
  )[0];
  if (!current) redirect("/");

  // スペック値と価格の記録は ON DELETE CASCADE で消えるが、R2 の画像は残るので片付ける
  await db.delete(products).where(eq(products.id, current.id));
  await deleteImage(current.imageKey);

  revalidatePath("/");
  revalidatePath(`/categories/${current.categoryId}`);
  redirect(`/categories/${current.categoryId}`);
}
