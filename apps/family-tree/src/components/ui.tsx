import { type FormEvent, startTransition } from "react";
import type { ActionState } from "@/lib/form";

/**
 * React 19 の <form action> は、アクションが終わると入力欄を初期値に戻す。エラーを返したときも
 * 戻るため、直したい値まで消えてしまう。onSubmit で自分で送り、入力をそのまま残す
 */
export function submitKeepingValues(action: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  };
}

export const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export const primaryButtonClass =
  "rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50";

export const secondaryButtonClass =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

export const dangerButtonClass =
  "rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950";

/** サーバーアクションの結果を出す */
export function FormMessage({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {state.error}
      </p>
    );
  if (state.success)
    return (
      <p
        role="status"
        className="text-sm text-emerald-700 dark:text-emerald-400"
      >
        {state.success}
      </p>
    );
  return null;
}
