"use client";

import { useActionState } from "react";
import {
  type PersonActionState,
  savePersonAction,
} from "@/app/actions/persons";
import type { Person } from "@/db/schema";
import {
  GENDER_LABELS,
  GENDERS,
  MAX_NOTE,
  MAX_PERSON_NAME,
} from "@/lib/constants";
import { DateField } from "./date-field";
import {
  FormMessage,
  inputClass,
  primaryButtonClass,
  submitKeepingValues,
} from "./ui";

const initial: PersonActionState = {};

/**
 * 人物の追加・編集フォーム。
 * person を渡すと編集、relativeOf と kind を渡すとその人の家族として追加する。
 */
export function PersonForm({
  treeId,
  person,
  relativeOf,
  kind,
  submitLabel,
  onSaved,
  onCancel,
}: {
  treeId: number;
  person?: Person;
  relativeOf?: number;
  kind?: "parent" | "child" | "partner";
  submitLabel: string;
  onSaved: (personId: number) => void;
  onCancel?: () => void;
}) {
  const [state, action, pending] = useActionState(
    async (prev: PersonActionState, formData: FormData) => {
      const result = await savePersonAction(prev, formData);
      if (result.success && result.personId) onSaved(result.personId);
      return result;
    },
    initial,
  );

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-3">
      <input type="hidden" name="treeId" value={treeId} />
      {person && <input type="hidden" name="personId" value={person.id} />}
      {relativeOf !== undefined && kind && (
        <>
          <input type="hidden" name="relativeOf" value={relativeOf} />
          <input type="hidden" name="kind" value={kind} />
        </>
      )}
      <label className="block space-y-1">
        <span className="text-xs text-zinc-500">名前（必須）</span>
        <input
          name="name"
          required
          maxLength={MAX_PERSON_NAME}
          defaultValue={person?.name}
          autoFocus
          className={inputClass}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-zinc-500">よみがな</span>
        <input
          name="kana"
          maxLength={MAX_PERSON_NAME}
          defaultValue={person?.kana ?? ""}
          className={inputClass}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-zinc-500">性別</span>
        <select
          name="gender"
          defaultValue={person?.gender ?? "unknown"}
          className={inputClass}
        >
          {GENDERS.map((g) => (
            <option key={g} value={g}>
              {GENDER_LABELS[g]}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <DateField
          name="birthDate"
          label="生年月日"
          placeholder="1950-04-01"
          defaultValue={person?.birthDate ?? ""}
        />
        <DateField
          name="deathDate"
          label="没年月日"
          placeholder="2020"
          defaultValue={person?.deathDate ?? ""}
        />
      </div>
      <p className="text-[11px] text-zinc-500">
        横のボタンでカレンダーから選べます。「1950」「1950-04」のように年や年月だけでも入れられます
      </p>
      <label className="block space-y-1">
        <span className="text-xs text-zinc-500">メモ</span>
        <textarea
          name="note"
          rows={3}
          maxLength={MAX_NOTE}
          defaultValue={person?.note ?? ""}
          className={inputClass}
        />
      </label>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}
