"use client";

import { useActionState } from "react";
import { saveEntry } from "@/app/actions/entries";
import { initialActionState } from "@/lib/form";
import { MAX_BODY_LENGTH } from "@/lib/limits";
import { MAX_PHOTOS_PER_ENTRY } from "@/lib/photo-limits";
import { PhotoInput } from "./photo-input";
import { Field, FormMessage, inputClass, SubmitButton } from "./ui";

type Props = {
  /** 編集のときだけ渡す */
  entry?: { id: number; happenedAt: string; body: string; photoCount: number };
  /** 新規のときの日時の初期値（日本時間のいま）。サーバで決めて渡す */
  defaultHappenedAt: string;
};

export function EntryForm({ entry, defaultHappenedAt }: Props) {
  const [state, action] = useActionState(saveEntry, initialActionState);
  const photoCount = entry?.photoCount ?? 0;

  return (
    // 写真を送るため multipart にする（Server Action では action に関数を渡すと自動で付く）
    <form action={action} className="space-y-4">
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <Field label="日時">
        <input
          type="datetime-local"
          name="happenedAt"
          required
          defaultValue={entry?.happenedAt ?? defaultHappenedAt}
          className={inputClass}
        />
      </Field>
      <Field label="本文">
        <textarea
          name="body"
          rows={10}
          maxLength={MAX_BODY_LENGTH}
          defaultValue={entry?.body}
          placeholder="今日あったこと"
          className={`${inputClass} leading-relaxed`}
        />
      </Field>
      <div className="space-y-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          写真
        </span>
        {photoCount >= MAX_PHOTOS_PER_ENTRY ? (
          <p className="text-xs text-zinc-500">
            写真は 1 件に {MAX_PHOTOS_PER_ENTRY}{" "}
            枚までです。追加するには先に不要な写真を削除してください
          </p>
        ) : (
          <PhotoInput name="photos" existing={photoCount} />
        )}
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="保存中…">
        {entry ? "更新する" : "記録する"}
      </SubmitButton>
    </form>
  );
}
