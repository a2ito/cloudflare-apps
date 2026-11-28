"use client";

import { useState } from "react";
import type { ParentChild, Partnership, Person } from "@/db/schema";
import { FamilyGraph } from "./family-graph";
import { PersonForm } from "./person-form";
import { PersonPanel } from "./person-panel";

export function FamilyView({
  treeId,
  persons,
  parents,
  partners,
}: {
  treeId: number;
  persons: Person[];
  parents: ParentChild[];
  partners: Partnership[];
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // 消した直後など、選んでいた人がもういなければ何も選んでいない扱いにする
  const selected = persons.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="h-[60dvh] min-h-80 flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-white lg:h-[calc(100dvh-10rem)] dark:border-zinc-800 dark:bg-zinc-950">
        {persons.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-500">
            まだ誰もいません。右（スマホでは下）のフォームから最初の 1
            人を追加してください
          </div>
        ) : (
          <FamilyGraph
            persons={persons}
            parents={parents}
            partners={partners}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
          />
        )}
      </div>
      <aside className="w-full shrink-0 rounded-lg border border-zinc-200 bg-white p-4 lg:max-h-[calc(100dvh-10rem)] lg:w-80 lg:overflow-y-auto dark:border-zinc-800 dark:bg-zinc-950">
        {selected ? (
          // 人を選び直したら、編集途中の状態を持ち越さないよう作り直す
          <PersonPanel
            key={selected.id}
            treeId={treeId}
            person={selected}
            persons={persons}
            parents={parents}
            partners={partners}
            onSelect={setSelectedId}
          />
        ) : (
          <section className="space-y-3">
            <h2 className="font-bold">人物を追加</h2>
            {persons.length > 0 && (
              <p className="text-xs text-zinc-500">
                グラフの人を押すと、詳しい情報と家族の追加ができます。ここでは、まだ誰ともつながっていない人を足せます
              </p>
            )}
            <PersonForm
              key={persons.length}
              treeId={treeId}
              submitLabel="追加"
              onSaved={setSelectedId}
            />
          </section>
        )}
      </aside>
    </div>
  );
}
