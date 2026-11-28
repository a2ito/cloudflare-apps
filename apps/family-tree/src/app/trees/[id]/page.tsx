import Link from "next/link";
import { FamilyView } from "@/components/family-view";
import { loadFamily } from "@/db/queries";
import { treeAccessFromParams } from "@/lib/tree-page";

export default async function TreePage({ params }: PageProps<"/trees/[id]">) {
  const { db, tree, role } = await treeAccessFromParams(params);
  const family = await loadFamily(db, tree.id);

  return (
    <main className="mx-auto max-w-6xl space-y-3 px-4 py-4">
      <nav className="flex items-center gap-3">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← 一覧
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">
          {tree.name}
        </h1>
        <Link
          href={`/trees/${tree.id}/settings`}
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {role === "owner" ? "設定・共有" : "メンバー"}
        </Link>
      </nav>
      <FamilyView
        treeId={tree.id}
        persons={family.persons}
        parents={family.parents}
        partners={family.partners}
      />
    </main>
  );
}
