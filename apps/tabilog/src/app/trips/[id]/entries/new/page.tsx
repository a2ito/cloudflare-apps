import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryForm } from "@/components/entry-form";
import { getDb } from "@/db";
import { getTrip } from "@/db/queries";
import { requireUser } from "@/lib/auth";

export default async function NewEntryPage({
  params,
}: PageProps<"/trips/[id]/entries/new">) {
  await requireUser();
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId)) notFound();

  const db = await getDb();
  const trip = await getTrip(db, tripId);
  if (!trip) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/trips/${trip.id}`}
        className="text-sm text-zinc-500 hover:underline"
      >
        ← {trip.name}
      </Link>
      <h1 className="text-xl font-bold">記録する</h1>
      <EntryForm trip={trip} />
    </div>
  );
}
