"use client";

import { useActionState, useEffect, useRef } from "react";
import type { PriceRecord } from "@/db/schema";
import { initialActionState, type ActionState } from "@/lib/form";
import { Field, FormMessage, inputClass, LinkButton, SubmitButton } from "./ui";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  productId: number;
  stores: string[];
  /** 記録日の初期値。サーバーで日本時間から決めて渡す */
  today: string;
  /** 渡すと編集フォームになる */
  record?: PriceRecord;
};

export function RecordForm({
  action,
  productId,
  stores,
  today,
  record,
}: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = record !== undefined;

  // 新規登録が成功したら価格などを空にして、続けて別の店を記録できるようにする
  useEffect(() => {
    if (isEdit || !state.success || !formRef.current) return;
    for (const name of ["price", "url", "memo"]) {
      const el = formRef.current.elements.namedItem(name);
      if (el instanceof HTMLInputElement) el.value = "";
    }
  }, [state, isEdit]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      {record && <input type="hidden" name="id" value={record.id} />}
      <FormMessage state={state} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="店舗">
          <input
            name="store"
            required
            maxLength={100}
            list="record-store-suggestions"
            defaultValue={record?.store}
            className={inputClass}
            placeholder="例: Amazon"
          />
          <datalist id="record-store-suggestions">
            {stores.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="税込価格（円）">
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
        <Field label="記録日">
          <input
            name="recordedAt"
            type="date"
            required
            defaultValue={record?.recordedAt ?? today}
            className={inputClass}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="used"
          value="1"
          defaultChecked={record?.used ?? false}
        />
        中古の価格（新品の記録がある商品では、比較表で「中古も含める」にしたときだけ最安値の候補になる）
      </label>

      <Field label="リンク" hint="商品ページの URL（任意）">
        <input
          name="url"
          type="url"
          inputMode="url"
          maxLength={2000}
          defaultValue={record?.url ?? ""}
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
          placeholder="セール価格、ポイント還元など"
        />
      </Field>

      <div className="flex gap-3">
        <SubmitButton pendingText={isEdit ? "保存中…" : "記録中…"}>
          {isEdit ? "更新する" : "価格を記録する"}
        </SubmitButton>
        {isEdit && (
          <LinkButton href={`/products/${productId}`}>キャンセル</LinkButton>
        )}
      </div>
    </form>
  );
}
