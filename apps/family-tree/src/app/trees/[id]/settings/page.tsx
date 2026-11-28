import Link from "next/link";
import {
  AddMemberForm,
  DeleteTreeForm,
  RemoveMemberButton,
  RenameTreeForm,
} from "@/components/tree-forms";
import { listMembers } from "@/db/queries";
import { treeAccessFromParams } from "@/lib/tree-page";

export default async function TreeSettingsPage({
  params,
}: PageProps<"/trees/[id]/settings">) {
  const { db, tree, role } = await treeAccessFromParams(params);
  const members = await listMembers(db, tree.id);
  const isOwner = role === "owner";

  return (
    <main className="mx-auto max-w-xl space-y-8 px-4 py-6">
      <nav className="flex items-center gap-3">
        <Link
          href={`/trees/${tree.id}`}
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← 家系図へ
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">
          {tree.name}
        </h1>
      </nav>

      {isOwner && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-500">名前</h2>
          <RenameTreeForm treeId={tree.id} name={tree.name} />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-500">
          共有しているメンバー
        </h2>
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {members.map((m) => (
            <li key={m.email} className="flex items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{m.email}</span>
              <span className="text-xs text-zinc-500">
                {m.role === "owner" ? "持ち主" : "編集者"}
              </span>
              {isOwner && m.role !== "owner" && (
                <RemoveMemberButton treeId={tree.id} email={m.email} />
              )}
            </li>
          ))}
        </ul>
        {isOwner ? (
          <>
            <AddMemberForm treeId={tree.id} />
            <p className="text-xs text-zinc-500">
              共有した人は、人物とつながりを追加・編集・削除できます。ログインできるのは
              このアプリに許可された Google
              アカウントだけなので、相手が入れないときは管理者に追加を頼んでください
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-500">
            名前の変更・共有・削除は持ち主だけができます
          </p>
        )}
      </section>

      {isOwner && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-red-600">家系図の削除</h2>
          <DeleteTreeForm treeId={tree.id} name={tree.name} />
        </section>
      )}
    </main>
  );
}
