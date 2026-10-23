"use client";

import { useActionState, useEffect, useRef } from "react";
import { addMeal } from "@/app/actions/meals";
import { initialActionState } from "@/lib/form";
import { MAX_KCAL } from "@/lib/limits";

export function MealForm({ eatenOn }: { eatenOn: string }) {
  const [state, action, pending] = useActionState(addMeal, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const foodRef = useRef<HTMLInputElement>(null);

  // 続けて何品も入れるので、保存できたら欄を空にして食品名へ戻す
  useEffect(() => {
    if (!state.success) return;
    formRef.current?.reset();
    foodRef.current?.focus();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="eatenOn" value={eatenOn} />
      <div className="flex gap-2">
        <input
          ref={foodRef}
          name="foodName"
          required
          maxLength={100}
          placeholder="食品名"
          aria-label="食品名"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          name="kcal"
          type="number"
          inputMode="numeric"
          required
          min={0}
          max={MAX_KCAL}
          step={1}
          placeholder="kcal"
          aria-label="カロリー（kcal）"
          className="w-24 rounded-md border border-zinc-300 bg-white px-3 py-2 text-right dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
        >
          記録
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
