"use client";

import { useRef, useState, useTransition } from "react";

interface MemberView {
  id: string;
  name: string;
}

interface BalanceView {
  memberId: string;
  name: string;
  net: number;
  netLabel: string;
}

export function MemberSection({
  members,
  balances,
  addAction,
  renameAction,
  removeAction,
}: {
  members: MemberView[];
  balances: BalanceView[];
  addAction: (formData: FormData) => Promise<void>;
  renameAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await addAction(formData);
        formRef.current?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "追加に失敗しました");
      }
    });
  }

  function handleRename(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await renameAction(formData);
        setEditingId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "名前の変更に失敗しました");
      }
    });
  }

  function handleRemove(memberId: string) {
    setError(null);
    const fd = new FormData();
    fd.set("memberId", memberId);
    startTransition(async () => {
      try {
        await removeAction(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "削除に失敗しました");
      }
    });
  }

  const balanceByMember = new Map(balances.map((b) => [b.memberId, b]));

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-black/5 p-5">
      <h2 className="font-semibold mb-3">メンバー</h2>

      {members.length === 0 ? (
        <p className="text-sm text-black/40 mb-3">
          まずメンバーを追加してください。
        </p>
      ) : (
        <ul className="space-y-1.5 mb-4">
          {members.map((m) => {
            const b = balanceByMember.get(m.id);
            const net = b?.net ?? 0;
            if (editingId === m.id) {
              return (
                <li key={m.id}>
                  <form action={handleRename} className="flex gap-2">
                    <input type="hidden" name="memberId" value={m.id} />
                    <input
                      name="name"
                      type="text"
                      required
                      maxLength={50}
                      defaultValue={m.name}
                      autoFocus
                      aria-label="新しい名前"
                      className="flex-1 min-w-0 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button
                      type="submit"
                      disabled={isPending}
                      className="shrink-0 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-3 transition-colors disabled:opacity-50"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setError(null);
                      }}
                      className="shrink-0 rounded-lg bg-black/5 hover:bg-black/10 text-sm px-3 transition-colors"
                    >
                      キャンセル
                    </button>
                  </form>
                </li>
              );
            }
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-black/5 px-3 py-2 text-sm"
              >
                <span className="font-medium">{m.name}</span>
                {b && net !== 0 && (
                  <span
                    className={
                      "text-xs " +
                      (net > 0 ? "text-emerald-600" : "text-rose-500")
                    }
                  >
                    {net > 0 ? "受取 " : "支払 "}
                    {b.netLabel.replace("-", "")}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(m.id);
                    setError(null);
                  }}
                  disabled={isPending}
                  className="ml-auto text-xs text-black/40 hover:text-emerald-600 transition-colors disabled:opacity-50"
                  aria-label={`${m.name}の名前を変更`}
                >
                  名前変更
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(m.id)}
                  disabled={isPending}
                  className="text-xs text-black/30 hover:text-rose-500 transition-colors disabled:opacity-50"
                  aria-label={`${m.name}を削除`}
                >
                  削除
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form ref={formRef} action={handleAdd} className="flex gap-2">
        <input
          name="name"
          type="text"
          required
          maxLength={50}
          placeholder="メンバー名"
          className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 transition-colors disabled:opacity-50"
        >
          追加
        </button>
      </form>

      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
    </section>
  );
}
