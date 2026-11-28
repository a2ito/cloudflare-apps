import Link from "next/link";
import { CreateTreeForm } from "@/components/tree-forms";
import { getDb } from "@/db";
import { listTreesFor } from "@/db/queries";
import { requireUser } from "@/lib/auth";

export default async function Home() {
  const user = await requireUser();
  const trees = await listTreesFor(await getDb(), user.email);

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <section className="space-y-2">
        <h1 className="text-lg font-bold">家系図</h1>
        {trees.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">
            まだ家系図がありません。下から作ってください
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {trees.map((tree) => (
              <li key={tree.id}>
                <Link
                  href={`/trees/${tree.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {tree.name}
                  </span>
                  {tree.role !== "owner" && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                      共有
                    </span>
                  )}
                  <span className="text-sm tabular-nums text-zinc-500">
                    {tree.personCount} 人
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-500">新しい家系図</h2>
        <CreateTreeForm />
      </section>
    </main>
  );
}
