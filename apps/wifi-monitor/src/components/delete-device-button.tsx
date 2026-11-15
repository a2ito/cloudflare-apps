"use client";

import { deleteDeviceAction } from "@/app/actions/devices";

/** 計測の記録ごと消えて戻せないので、押したら一度確かめる */
export function DeleteDeviceButton({
  deviceId,
  deviceName,
}: {
  deviceId: number;
  deviceName: string;
}) {
  return (
    <form
      action={deleteDeviceAction}
      onSubmit={(event) => {
        if (
          !confirm(`「${deviceName}」と計測の記録を消します。元に戻せません。`)
        ) {
          event.preventDefault();
        }
      }}
      className="border-t border-zinc-200 pt-4 dark:border-zinc-800"
    >
      <input type="hidden" name="id" value={deviceId} />
      <button
        type="submit"
        className="text-sm text-red-600 hover:underline dark:text-red-400"
      >
        この端末と計測の記録を消す
      </button>
    </form>
  );
}
