import Link from "next/link";
import { notFound } from "next/navigation";
import { EditSentenceForm } from "@/components/sentence-forms";
import { getDb } from "@/db";
import { getSentence, listDecksWithStats } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/date";
import { parseId } from "@/lib/form";

export default async function EditSentencePage({
  params,
}: PageProps<"/sentences/[id]/edit">) {
  const user = await requireUser();
  const id = parseId((await params).id);
  if (id === undefined) notFound();

  const db = await getDb();
  const [sentence, decks] = await Promise.all([
    getSentence(db, user.id, id),
    listDecksWithStats(db, user.id, today()),
  ]);
  if (!sentence) notFound();

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <div>
        <Link
          href={`/decks/${sentence.deckId}`}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← セットへ戻る
        </Link>
        <h1 className="text-xl font-bold">文を編集</h1>
      </div>
      <EditSentenceForm sentence={sentence} decks={decks} />
    </main>
  );
}
