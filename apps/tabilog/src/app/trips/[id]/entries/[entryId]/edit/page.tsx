import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEntryAction } from "@/app/actions/entries";
import { EntryForm } from "@/components/entry-form";
import { ConfirmForm, DangerButton } from "@/components/ui";
import { getDb } from "@/db";
import { getEntry, getTrip } from "@/db/queries";
import { requireUser } from "@/lib/auth";

export default async function EditEntryPage({
  params,
}: PageProps<"/trips/[id]/entries/[entryId]/edit">) {
  await requireUser();
  const { id, entryId } = await params;
  const tripId = Number(id);
  const numericEntryId = Number(entryId);
  if (!Number.isInteger(tripId) || !Number.isInteger(numericEntryId))
    notFound();

  const db = await getDb();
  const [trip, entry] = await Promise.all([
    getTrip(db, tripId),
    getEntry(db, numericEntryId),
  ]);
  if (!trip || !entry || entry.tripId !== trip.id) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/trips/${trip.id}/entries/${entry.id}`}
        className="text-sm text-zinc-500 hover:underline"
      >
        ← {entry.title}
      </Link>
      <h1 className="text-xl font-bold">記録を編集</h1>
      <EntryForm trip={trip} entry={entry} />

      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <ConfirmForm
          action={deleteEntryAction}
          message={`「${entry.title}」を削除しますか？写真とコメントも消えます`}
        >
          <input type="hidden" name="id" value={entry.id} />
          <input type="hidden" name="tripId" value={trip.id} />
          <DangerButton>この記録を削除する</DangerButton>
        </ConfirmForm>
      </div>
    </div>
  );
}
