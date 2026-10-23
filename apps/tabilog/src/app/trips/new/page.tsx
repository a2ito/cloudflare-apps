import { TripForm } from "@/components/trip-form";
import { requireUser } from "@/lib/auth";

export default async function NewTripPage() {
  await requireUser();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">旅行をつくる</h1>
      <TripForm />
    </div>
  );
}
