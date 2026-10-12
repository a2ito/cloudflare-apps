import Link from "next/link";
import { NewDeckForm } from "@/components/deck-forms";
import { getDb } from "@/db";
import { listDecksWithStats } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/date";

export default async function Home() {
	const user = await requireUser();
	const db = await getDb();
	const decks = await listDecksWithStats(db, user.id, today());
	const total = decks.reduce((sum, d) => sum + d.total, 0);
	const due = decks.reduce((sum, d) => sum + d.due, 0);

	return (
		<main className="mx-auto max-w-xl space-y-6 px-4 py-6">
			{total > 0 && (
				<section className="flex items-center justify-between gap-4 rounded-lg bg-indigo-50 p-4 dark:bg-indigo-950/40">
					<div>
						<p className="text-sm text-zinc-500">今日の復習</p>
						<p className="text-2xl font-bold tabular-nums">
							{due}
							<span className="ml-1 text-sm font-normal text-zinc-500">/ {total} 文</span>
						</p>
					</div>
					<Link href="/practice" className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700">
						全セットで練習
					</Link>
				</section>
			)}

			<section className="space-y-3">
				<h1 className="text-lg font-bold">セット</h1>
				{decks.length === 0 ? (
					<p className="py-4 text-sm text-zinc-500">まずはセットを作って、日本文と英文を登録しましょう</p>
				) : (
					<ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
						{decks.map((deck) => (
							<li key={deck.id} className="flex items-center gap-3 py-3">
								<Link href={`/decks/${deck.id}`} className="min-w-0 flex-1 hover:underline">
									<span className="block truncate font-medium">{deck.name}</span>
									<span className="text-xs text-zinc-500 tabular-nums">
										{deck.total} 文・今日 {deck.due} 文
									</span>
								</Link>
								{deck.total > 0 && (
									<Link
										href={`/practice?deck=${deck.id}`}
										className="rounded-md border border-indigo-300 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
									>
										練習
									</Link>
								)}
							</li>
						))}
					</ul>
				)}
				<NewDeckForm />
			</section>
		</main>
	);
}
