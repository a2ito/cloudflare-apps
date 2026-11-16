"use client";

import { useActionState } from "react";
import {
  renameNetworkAction,
  type RenameNetworkState,
} from "@/app/actions/networks";
import { MAX_NETWORK_NAME_LENGTH } from "@/lib/limits";

const initialState: RenameNetworkState = { status: "idle" };

export function NetworkNameForm({
  networkId,
  name,
}: {
  networkId: number;
  name: string;
}) {
  const [state, action, pending] = useActionState(
    renameNetworkAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="id" value={networkId} />
      <div className="flex gap-2">
        <input
          name="name"
          required
          defaultValue={name}
          maxLength={MAX_NETWORK_NAME_LENGTH}
          aria-label="ネットワークの名前"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          名前を変える
        </button>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.status === "saved" && (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-400"
        >
          「{state.name}」に変えました
        </p>
      )}
    </form>
  );
}
