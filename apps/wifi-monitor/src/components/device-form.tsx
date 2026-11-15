"use client";

import { useActionState } from "react";
import {
  createDeviceAction,
  type CreateDeviceState,
} from "@/app/actions/devices";
import { MAX_DEVICE_NAME_LENGTH } from "@/lib/limits";

const initialState: CreateDeviceState = { status: "idle" };

/** 端末を登録し、発行したトークンをその場で 1 回だけ見せる */
export function DeviceForm({ apiOrigin }: { apiOrigin: string }) {
  const [state, action, pending] = useActionState(
    createDeviceAction,
    initialState,
  );

  return (
    <div className="space-y-3">
      <form action={action} className="flex gap-2">
        <input
          name="name"
          required
          maxLength={MAX_DEVICE_NAME_LENGTH}
          placeholder="端末名（例: 書斎の Mac）"
          aria-label="端末名"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          登録
        </button>
      </form>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.status === "created" && (
        <div
          role="status"
          className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950"
        >
          <p className="font-semibold">
            「{state.name}
            」を登録しました。トークンはこの画面でしか表示されません
          </p>
          <p>エージェントの設定に次の 2 つを書いてください。</p>
          <pre className="overflow-x-auto rounded bg-white p-2 text-xs select-all dark:bg-zinc-900">
            {`WIFI_MONITOR_URL=${apiOrigin}\nWIFI_MONITOR_TOKEN=${state.token}`}
          </pre>
          <p className="text-zinc-600 dark:text-zinc-400">
            控え損ねたら、端末を消して登録し直してください。
          </p>
        </div>
      )}
    </div>
  );
}
