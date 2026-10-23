"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { type ActionState, initialActionState } from "@/lib/form";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  /** 追加のフォームは、続けて入れられるよう保存できたら欄を空にする */
  resetOnSuccess?: boolean;
  /** 保存できたら移る先。今日の記録では ?menu= を外し、ローテーションの次のメニューに戻す */
  successHref?: string;
  className?: string;
  children: React.ReactNode;
};

/** 欄はサーバー側で組み、送信中の表示と結果のメッセージだけをここで持つ */
export function ActionForm({
  action,
  submitLabel,
  resetOnSuccess = false,
  successHref,
  className,
  children,
}: Props) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!state.success) return;
    if (resetOnSuccess) formRef.current?.reset();
    if (successHref) router.replace(successHref);
  }, [state, resetOnSuccess, successHref, router]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {submitLabel}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="text-sm text-zinc-500">{state.success}</p>
        )}
      </div>
    </form>
  );
}
