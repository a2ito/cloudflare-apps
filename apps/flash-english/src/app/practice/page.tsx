import Link from "next/link";
import { notFound } from "next/navigation";
import { Practice } from "@/components/practice";
import { getDb } from "@/db";
import { getDeck, listPracticeCandidates } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/date";
import { parseId } from "@/lib/form";
import { pickQuestions } from "@/lib/srs";

export default async function PracticePage({
  searchParams,
}: PageProps<"/practice">) {
  const user = await requireUser();
  const { deck: deckParam } = await searchParams;
  const deckId = parseId(deckParam);

  const db = await getDb();
  const deck = deckId === undefined ? null : await getDeck(db, user.id, deckId);
  if (deckId !== undefined && !deck) notFound();

  const candidates = await listPracticeCandidates(db, user.id, deck?.id);
  // 答えの英文まで渡すのは、答えを見るたびにサーバーへ問い合わせず、すぐ出すため
  const questions = pickQuestions(candidates, today()).map(
    ({ id, ja, en, note }) => ({ id, ja, en, note }),
  );

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <h1 className="text-sm text-zinc-500">{deck ? deck.name : "全セット"}</h1>
      {questions.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          練習する文がありません。
          <Link
            href={deck ? `/decks/${deck.id}` : "/"}
            className="ml-1 text-indigo-600 hover:underline"
          >
            文を登録する
          </Link>
        </p>
      ) : (
        <Practice questions={questions} />
      )}
    </main>
  );
}
