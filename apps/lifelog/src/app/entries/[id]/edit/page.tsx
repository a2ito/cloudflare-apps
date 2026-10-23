import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryForm } from "@/components/entry-form";
import { getDb } from "@/db";
import { getEntry } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { nowWallClock } from "@/lib/datetime";
import { idFromForm } from "@/lib/form";

export default async function EditEntryPage({
  params,
}: PageProps<"/entries/[id]/edit">) {
  const user = await requireUser();
  const id = idFromForm.safeParse((await params).id);
  if (!id.success) notFound();

  const db = await getDb();
  const entry = await getEntry(db, user.id, id.data);
  if (!entry) notFound();

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">日記を直す</h1>
        <Link
          href={`/entries/${entry.id}`}
          className="text-sm text-zinc-500 hover:underline"
        >
          戻る
        </Link>
      </div>
      <EntryForm
        entry={{
          id: entry.id,
          happenedAt: entry.happenedAt,
          body: entry.body,
          photoCount: entry.photos.length,
        }}
        defaultHappenedAt={nowWallClock()}
      />
      {entry.photos.length > 0 && (
        <p className="text-xs text-zinc-500">
          付いている写真の削除は、日記の詳細画面から行えます
        </p>
      )}
    </main>
  );
}
