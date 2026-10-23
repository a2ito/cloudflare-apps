import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEntryAction } from "@/app/actions/entries";
import { PhotoGallery } from "@/components/photo-gallery";
import { ConfirmForm, DangerButton, LinkButton } from "@/components/ui";
import { getDb } from "@/db";
import { getEntry } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { formatDay, formatTime } from "@/lib/datetime";
import { idFromForm } from "@/lib/form";
import { photoFileName } from "@/lib/photo-name";
import { photoUrl } from "@/lib/photos";

export default async function EntryPage({
  params,
}: PageProps<"/entries/[id]">) {
  const user = await requireUser();
  const id = idFromForm.safeParse((await params).id);
  if (!id.success) notFound();

  const db = await getDb();
  const entry = await getEntry(db, user.id, id.data);
  if (!entry) notFound();

  // ダウンロード名は日時から付ける（"2026-09-25-1230-1.jpg"）
  const title = entry.happenedAt.replace("T", "-").replace(":", "");

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← 一覧
        </Link>
        <LinkButton href={`/entries/${entry.id}/edit`}>編集</LinkButton>
      </div>

      <header>
        <h1 className="text-lg font-bold">{formatDay(entry.happenedAt)}</h1>
        <p className="text-sm text-zinc-500">{formatTime(entry.happenedAt)}</p>
      </header>

      {entry.body && (
        <p className="whitespace-pre-wrap leading-relaxed">{entry.body}</p>
      )}

      {entry.photos.length > 0 && (
        <PhotoGallery
          photos={entry.photos.map((p, i) => ({
            id: p.id,
            src: photoUrl(p.key),
            downloadName: photoFileName(title, i, p.contentType),
          }))}
        />
      )}

      <ConfirmForm
        action={deleteEntryAction}
        message="この日記を削除しますか？写真も一緒に消えます"
      >
        <input type="hidden" name="id" value={entry.id} />
        <DangerButton>日記を削除</DangerButton>
      </ConfirmForm>
    </main>
  );
}
