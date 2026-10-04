"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  forgetGroup,
  loadRecentGroups,
  saveRecentGroups,
  type RecentGroup,
} from "@/lib/recent-groups";

const dateFormat = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
});

// トップに出す「最近のグループ」。localStorage はサーバで読めないので、
// 読み込むまでは何も描かない（初回の HTML と食い違わないようにするため）。
export function RecentGroups() {
  const [groups, setGroups] = useState<RecentGroup[]>([]);

  useEffect(() => {
    setGroups(loadRecentGroups());
  }, []);

  function forget(id: string) {
    const next = forgetGroup(groups, id);
    saveRecentGroups(next);
    setGroups(next);
  }

  if (groups.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-black/5 p-6">
      <h2 className="font-semibold mb-1">最近のグループ</h2>
      <p className="text-xs text-black/50 mb-3">
        この端末で開いたグループです。
      </p>
      <ul className="divide-y divide-black/5">
        {groups.map((g) => (
          <li key={g.id} className="flex items-center gap-2">
            <Link
              href={`/g/${g.id}`}
              className="flex-1 min-w-0 flex items-baseline gap-2 py-2.5 hover:text-emerald-700"
            >
              <span className="truncate font-medium">{g.name}</span>
              <span className="shrink-0 text-xs text-black/40">
                {dateFormat.format(g.visitedAt)}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => forget(g.id)}
              aria-label={`${g.name} を一覧から外す`}
              className="shrink-0 rounded-lg px-2 py-1 text-black/30 hover:bg-black/5 hover:text-black/60"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
