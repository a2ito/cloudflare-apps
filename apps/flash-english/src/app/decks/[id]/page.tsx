import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDeckAction } from "@/app/actions/decks";
import { deleteSentenceAction } from "@/app/actions/sentences";
import { ConfirmButton } from "@/components/confirm-button";
import { SpeakButton } from "@/components/speak-button";
import { RenameDeckForm } from "@/components/deck-forms";
import { BulkSentenceForm, NewSentenceForm } from "@/components/sentence-forms";
import { getDb } from "@/db";
import { getDeck, listSentences } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/date";
import { parseId } from "@/lib/form";
import { isDue } from "@/lib/srs";

export default async function DeckPage({ params }: PageProps<"/decks/[id]">) {
  const user = await requireUser();
  const id = parseId((await params).id);
  if (id === undefined) notFound();

  const db = await getDb();
  const deck = await getDeck(db, user.id, id);
  if (!deck) notFound();
  const sentences = await listSentences(db, user.id, deck.id);
  const todayStr = today();

  return (
    <main className="mx-auto max-w-xl space-y-8 px-4 py-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            ← セット一覧
          </Link>
          <h1 className="truncate text-xl font-bold">{deck.name}</h1>
        </div>
        {sentences.length > 0 && (
          <Link
            href={`/practice?deck=${deck.id}`}
            className="rounded-md bg-indigo-600 px-4 py-2 font-semibold whitespace-nowrap text-white hover:bg-indigo-700"
          >
            練習する
          </Link>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">文を登録</h2>
        <NewSentenceForm deckId={deck.id} />
        <details className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-medium">
            まとめて登録
          </summary>
          <div className="mt-3">
            <BulkSentenceForm deckId={deck.id} />
          </div>
        </details>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">
          登録した文{" "}
          <span className="text-sm font-normal text-zinc-500 tabular-nums">
            {sentences.length}
          </span>
        </h2>
        {sentences.length === 0 ? (
          <p className="py-4 text-sm text-zinc-500">まだ文がありません</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {sentences.map((s) => (
              <li key={s.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p>{s.ja}</p>
                  <p lang="en" className="text-indigo-700 dark:text-indigo-300">
                    {s.en}
                    <SpeakButton text={s.en} />
                  </p>
                  {s.note && <p className="text-xs text-zinc-500">{s.note}</p>}
                  <p className="text-xs text-zinc-400 tabular-nums">
                    ○{s.correctCount} ×{s.wrongCount}・
                    {isDue(s.dueOn, todayStr) ? "今日出る" : `次は ${s.dueOn}`}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-2 text-sm">
                  <Link
                    href={`/sentences/${s.id}/edit`}
                    className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    編集
                  </Link>
                  <form action={deleteSentenceAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="deckId" value={deck.id} />
                    <ConfirmButton
                      message={`「${s.ja}」を消しますか？`}
                      className="text-zinc-400 hover:text-red-600"
                    >
                      削除
                    </ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="font-semibold">セットの設定</h2>
        <RenameDeckForm id={deck.id} name={deck.name} />
        <form action={deleteDeckAction}>
          <input type="hidden" name="id" value={deck.id} />
          <ConfirmButton
            message={`「${deck.name}」と中の ${sentences.length} 文を消しますか？`}
            className="text-sm text-red-600 hover:underline"
          >
            このセットを削除
          </ConfirmButton>
        </form>
      </section>
    </main>
  );
}
