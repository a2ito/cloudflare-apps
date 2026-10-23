"use client";

import { useActionState, useEffect, useRef } from "react";
import { addComment } from "@/app/actions/comments";
import { initialActionState } from "@/lib/form";
import { FormMessage, inputClass, SubmitButton } from "./ui";

export function CommentForm({
  entryId,
  parentId,
  placeholder = "コメントを書く…",
  autoFocus = false,
}: {
  entryId: number;
  parentId?: number;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [state, formAction] = useActionState(addComment, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  // 投稿できたら入力欄を空に戻す
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="entryId" value={entryId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      {state.error && <FormMessage state={state} />}
      <textarea
        name="body"
        rows={parentId ? 2 : 3}
        required
        maxLength={2000}
        autoFocus={autoFocus}
        className={inputClass}
        placeholder={placeholder}
      />
      <SubmitButton pendingText="投稿中…">
        {parentId ? "返信する" : "コメントする"}
      </SubmitButton>
    </form>
  );
}
