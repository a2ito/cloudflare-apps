"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import type { PriceRecord, Unit, Variant } from "@/db/schema";
import { initialActionState, type ActionState } from "@/lib/form";
import { imageUrl } from "@/lib/images";
import { formatAmount, formatPackage, formatYen, todayIso } from "@/lib/price";
import { RECORD_PHOTO } from "@/lib/image-shrink";
import { ImageInput } from "./image-input";
import { Field, FormMessage, inputClass, LinkButton, SubmitButton } from "./ui";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  productId: number;
  variantId: number;
  unit: Unit;
  /** 容量の初期値と入力欄の説明に使う */
  variant: Pick<Variant, "amount" | "count">;
  stores: string[];
  /** 渡すと編集フォームになる */
  record?: PriceRecord;
  /**
   * 同じ店の価格を更新するときの元の記録。店舗・個数・容量・リンクを引き継いで新しく記録する。
   * 記録したら商品ページへ戻る
   */
  previous?: PriceRecord;
};

export function RecordForm({
  action,
  productId,
  variantId,
  unit,
  variant,
  stores,
  record,
  previous,
}: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  // 記録するたびに画像入力を初期状態へ戻すための鍵
  const [imageResetKey, setImageResetKey] = useState(0);
  const isEdit = record !== undefined;
  // 価格・日付・メモ・写真はその時々で変わるので引き継がない
  const initial = record ?? previous;

  // 新規登録が成功したら入力欄を空にして、続けて別の店を記録できるようにする
  useEffect(() => {
    if (isEdit || previous || !state.success || !formRef.current) return;
    for (const name of ["price", "amount", "url", "memo"]) {
      const el = formRef.current.elements.namedItem(name);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
        el.value = "";
    }
    setImageResetKey((n) => n + 1);
  }, [state, isEdit, previous]);

  // 同じ店の価格を更新したら、履歴と並べて確かめられるよう商品ページへ戻る
  useEffect(() => {
    if (previous && state.success) router.push(`/products/${productId}`);
  }, [state, previous, productId, router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="variantId" value={variantId} />
      {record && <input type="hidden" name="id" value={record.id} />}
      <FormMessage state={state} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="店舗">
          <input
            name="store"
            required
            list={`store-suggestions-${variantId}`}
            defaultValue={initial?.store}
            className={inputClass}
            placeholder="例: OK ストア"
          />
          <datalist id={`store-suggestions-${variantId}`}>
            {stores.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="記録日">
          <input
            name="recordedAt"
            type="date"
            required
            defaultValue={record?.recordedAt ?? todayIso()}
            className={inputClass}
          />
        </Field>
        <Field
          label="税込価格（円）"
          hint={
            previous
              ? `前回 ${formatYen(previous.price, 0)}（${previous.recordedAt}）`
              : undefined
          }
        >
          <input
            name="price"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            defaultValue={record?.price}
            className={inputClass}
          />
        </Field>
        <Field
          label="個数"
          hint={`1 個 = ${formatPackage(variant.amount, variant.count, unit)}。まとめ買いした場合は個数を増やす`}
        >
          <input
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            defaultValue={initial?.quantity ?? 1}
            className={inputClass}
          />
        </Field>
        <Field
          label={`1 個あたりの容量（${unit}・任意）`}
          hint={`増量や内容量の変更があったときだけ入力する。空欄なら荷姿の ${formatAmount(variant.amount, 1, unit)}`}
        >
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            min={0.01}
            step="any"
            defaultValue={initial?.amount ?? ""}
            className={inputClass}
            placeholder={String(variant.amount)}
          />
        </Field>
      </div>

      <Field label="リンク" hint="商品ページやチラシの URL（任意）">
        <input
          name="url"
          type="url"
          inputMode="url"
          maxLength={2000}
          defaultValue={initial?.url ?? ""}
          className={inputClass}
          placeholder="https://..."
        />
      </Field>

      <Field label="メモ">
        <input
          name="memo"
          maxLength={500}
          defaultValue={record?.memo ?? ""}
          className={inputClass}
          placeholder="セール価格、会員価格など"
        />
      </Field>

      <Field label="写真（値札やレシートなど・任意）">
        <ImageInput
          key={imageResetKey}
          name="image"
          profile={RECORD_PHOTO}
          currentUrl={record?.imageKey ? imageUrl(record.imageKey) : null}
        />
      </Field>
      {record?.imageKey && (
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" name="removeImage" /> 写真を削除する
        </label>
      )}

      <div className="flex gap-3">
        <SubmitButton pendingText={isEdit ? "保存中…" : "記録中…"}>
          {isEdit ? "更新する" : "価格を記録する"}
        </SubmitButton>
        {(isEdit || previous) && (
          <LinkButton href={`/products/${productId}`}>キャンセル</LinkButton>
        )}
      </div>
    </form>
  );
}
