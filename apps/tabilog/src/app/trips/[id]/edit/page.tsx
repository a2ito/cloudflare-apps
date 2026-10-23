import Link from "next/link";
import { notFound } from "next/navigation";
import { TripForm } from "@/components/trip-form";
import { ConfirmForm, DangerButton } from "@/components/ui";
import { deleteTripAction } from "@/app/actions/trips";
import { getDb } from "@/db";
import { getTrip } from "@/db/queries";
import { requireUser } from "@/lib/auth";

export default async function EditTripPage({
  params,
}: PageProps<"/trips/[id]/edit">) {
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
      <h1 className="text-xl font-bold">旅行を編集</h1>
      <TripForm trip={trip} />

      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <ConfirmForm
          action={deleteTripAction}
          message={`「${trip.name}」を削除しますか？記録・写真・コメントもすべて消えます`}
        >
          <input type="hidden" name="id" value={trip.id} />
          <DangerButton>この旅行を削除する</DangerButton>
        </ConfirmForm>
      </div>
    </div>
  );
}
