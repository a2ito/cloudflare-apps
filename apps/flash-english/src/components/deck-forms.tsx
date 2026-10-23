"use client";

import { useActionState, useEffect, useRef } from "react";
import { addDeck, renameDeckAction } from "@/app/actions/decks";
import { initialActionState } from "@/lib/form";
import { MAX_DECK_NAME } from "@/lib/limits";
import { FormMessage } from "./form-message";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "./ui";

export function NewDeckForm() {
  const [state, action, pending] = useActionState(addDeck, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <div className="flex gap-2">
        <input
          name="name"
          required
          maxLength={MAX_DECK_NAME}
          placeholder="新しいセット名（例: 中学1年 be動詞）"
          aria-label="セット名"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={pending}
          className={`${primaryButtonClass} whitespace-nowrap`}
        >
          作る
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function RenameDeckForm({ id, name }: { id: number; name: string }) {
  const [state, action, pending] = useActionState(
    renameDeckAction,
    initialActionState,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex gap-2">
        <input
          name="name"
          required
          maxLength={MAX_DECK_NAME}
          defaultValue={name}
          aria-label="セット名"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={pending}
          className={`${secondaryButtonClass} whitespace-nowrap`}
        >
          名前を変える
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
