"use client";

import { useEffect, useState } from "react";

type Props = {
  roomId: string;
  onJoin: (formData: FormData) => void;
  onVote: (formData: FormData) => void;
  onUnvote: (formData: FormData) => void;
  onLeave: (roomId: string, name: string) => void;
  onRoomFetch: () => void;
  revealed?: boolean;
  roomVotes: Record<string, number | null>;
};

const STORAGE_PREFIX = "planning-poker:";

export function ClientForms({
  roomId,
  onJoin,
  onVote,
  onUnvote,
  onLeave,
  onRoomFetch,
  revealed = false,
  roomVotes,
}: Props) {
  const [name, setName] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  // localStorage から参加者名を復元
  useEffect(() => {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${roomId}`);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (parsed?.name) {
        setName(parsed.name);
      }
    } catch {
      // ignore
    }
  }, [roomId]);

  // 自分の投票を復元
  useEffect(() => {
    if (name && roomVotes[name] !== undefined) {
      setSelected(roomVotes[name]);
    }
  }, [name, roomVotes]);

  // Reveal されたら選択をリセット
  useEffect(() => {
    if (revealed) {
      setSelected(null);
    }
  }, [revealed]);

  // planning-poker 関連キーを全削除
  const clearPlanningPokerKeys = () => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach((k) => localStorage.removeItem(k));
  };

  // 参加
  const handleJoin = (formData: FormData) => {
    const n = formData.get("name")?.toString().trim();
    if (!n) return;

    clearPlanningPokerKeys();

    localStorage.setItem(
      `${STORAGE_PREFIX}${roomId}`,
      JSON.stringify({ name: n }),
    );

    setName(n);
    onJoin(formData);
  };

  // 投票
  const handleVote = async (formData: FormData) => {
    if (!name) return;

    const value = Number(formData.get("value"));

    // 選択解除の場合
    if (selected === null) {
      const fd = new FormData();
      fd.set("name", name);
      await onUnvote(fd);
      await onRoomFetch();
      return;
    }

    formData.set("name", name);
    await onVote(formData);
    await onRoomFetch();
  };

  // 投票取り消し
  const handleUnvote = () => {
    if (!name) return;
    const fd = new FormData();
    fd.set("name", name);
    onUnvote(fd);
    onRoomFetch?.();
  };

  // 退出
  const handleLeave = () => {
    if (!name) return;
    clearPlanningPokerKeys();
    onLeave(roomId, name);
    setName(null);
    setSelected(null);
  };

  return (
    <div className="space-y-6">
      {/* 未参加 */}
      {!name && (
        <form
          action={handleJoin}
          className="space-y-4 rounded-xl bg-white p-6 shadow"
        >
          <h3 className="text-center text-lg font-bold text-slate-900">
            参加者名を入力
          </h3>

          <input
            name="name"
            placeholder="あなたの名前"
            required
            className="w-full rounded-lg border bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />

          <button
            type="submit"
            className="rounded-lx w-full bg-blue-600 py-3 text-lg font-semibold text-white transition hover:bg-blue-700 active:scale-95"
          >
            参加
          </button>
        </form>
      )}

      {/* 参加済み */}
      {name && (
        <div className="space-y-6 rounded-xl bg-white p-6 shadow">
          <div className="text-center">
            <p className="text-sm text-slate-600">参加者名</p>
            <p className="text-lg font-semibold text-slate-900">{name}</p>
          </div>

          {/* 投票 */}
          <form action={handleVote} className="space-y-4">
            <p className="text-center font-medium text-slate-800">
              見積もりを選択
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              {[1, 2, 3, 5, 8, 13, 21].map((v) => {
                const isSelected = selected === v;

                return (
                  <button
                    key={v}
                    type="submit"
                    name="value"
                    value={v}
                    onClick={() => {
                      setSelected((prev) => {
                        // 解除
                        if (prev === v) {
                          return null;
                        }

                        // 選択
                        return v;
                      });
                    }}
                    disabled={revealed}
                    className={`h-24 w-16 rounded-xl border text-2xl font-extrabold shadow transition-all duration-150 ${
                      isSelected
                        ? "-translate-y-1 scale-110 border-blue-600 bg-blue-600 text-white shadow-lg"
                        : "bg-white text-slate-900 hover:border-blue-400 hover:bg-blue-50"
                    } ${
                      revealed
                        ? "cursor-not-allowed opacity-50"
                        : "active:scale-95"
                    } `}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </form>

          {/* 退出 */}
          <div className="text-center">
            <button
              type="button"
              onClick={handleLeave}
              className="text-sm text-red-600 hover:underline"
            >
              退出する
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
