"use client";

import { useState, useTransition } from "react";

export function DeleteGroupButton({
  groupName,
  deleteAction,
}: {
  groupName: string;
  deleteAction: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`「${groupName}」を削除します。元に戻せません。よろしいですか？`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        // 成功すると Server Action の redirect で一覧へ移る
        await deleteAction();
      } catch (e) {
        setError(e instanceof Error ? e.message : "削除に失敗しました");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 transition-colors disabled:opacity-50"
      >
        {isPending ? "削除しています…" : "このグループを削除"}
      </button>
      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
    </div>
  );
}
