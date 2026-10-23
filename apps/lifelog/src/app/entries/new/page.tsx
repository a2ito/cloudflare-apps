import { EntryForm } from "@/components/entry-form";
import { requireUser } from "@/lib/auth";
import { nowWallClock } from "@/lib/datetime";

export default async function NewEntryPage() {
  await requireUser();
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <h1 className="text-lg font-bold">日記を書く</h1>
      <EntryForm defaultHappenedAt={nowWallClock()} />
    </main>
  );
}
