"use client";

import { useState, useEffect } from "react";

type Props = {
  participants: string[];
  votes: Record<string, number>;
  revealed: boolean;
};

export function Participants({ participants, votes, revealed }: Props) {
  // サーバー状態から初期化
  const [votedMap, setVotedMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(participants.map((p) => [p, votes[p] !== undefined])),
  );

  // サーバー再取得時に同期（revalidate / refresh 対応）
  useEffect(() => {
    setVotedMap(
      Object.fromEntries(participants.map((p) => [p, votes[p] !== undefined])),
    );
  }, [participants, votes]);

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {participants.map((p) => {
        const voted = votedMap[p];

        return (
          <li key={p} className={`card h-28 ${revealed ? "revealed" : ""}`}>
            <div className="card-inner rounded-xl border shadow">
              {/* 裏面 */}
              <div className="card-face card-back">
                <div className="text-center">
                  <div className="text-sm text-slate-700 sm:text-base md:text-lg">
                    {p}
                  </div>
                  <div className="mt-1 text-3xl font-bold text-slate-700">
                    {voted ? "✓" : "…"}
                  </div>
                </div>
              </div>

              {/* 表面 */}
              <div className="card-face card-front">
                <div className="text-center">
                  <div className="text-sm text-green-700">{p}</div>
                  <div className="text-3xl font-extrabold text-green-700">
                    {votes[p] ?? "?"}
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
