import Link from "next/link";
import { LinkButton } from "@/components/ui";
import { getDb } from "@/db";
import { decodeCursor, type EntryWithPhotos, listEntries } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { dayOf, formatDay, formatTime } from "@/lib/datetime";
import { PAGE_SIZE } from "@/lib/limits";
import { photoUrl } from "@/lib/photos";

/** 一覧のカードに並べる写真の枚数。残りは「+N」で知らせる */
const THUMBNAILS = 4;

export default async function Home({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const { before } = await searchParams;
  const cursor = decodeCursor(typeof before === "string" ? before : undefined);

  const db = await getDb();
  const { entries, next } = await listEntries(db, user.id, {
    before: cursor,
    limit: PAGE_SIZE,
  });
  const days = Map.groupBy(entries, (e) => dayOf(e.happenedAt));

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <div className="flex justify-end">
        <LinkButton href="/entries/new" variant="primary">
          ＋ 日記を書く
        </LinkButton>
      </div>

      {entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500">
          {cursor ? "これより古い日記はありません" : "まだ日記がありません"}
        </p>
      ) : (
        [...days].map(([day, items]) => (
          <section key={day} className="space-y-2">
            <h2 className="text-sm font-bold text-zinc-500">
              {formatDay(day)}
            </h2>
            <ul className="space-y-2">
              {items.map((entry) => (
                <li key={entry.id}>
                  <EntryCard entry={entry} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {next && (
        <div className="text-center">
          <Link
            href={`/?before=${encodeURIComponent(next)}`}
            className="text-sm text-sky-700 hover:underline dark:text-sky-400"
          >
            もっと古い日記
          </Link>
        </div>
      )}
    </main>
  );
}

function EntryCard({ entry }: { entry: EntryWithPhotos }) {
  const shown = entry.photos.slice(0, THUMBNAILS);
  const hidden = entry.photos.length - shown.length;

  return (
    <Link
      href={`/entries/${entry.id}`}
      className="block space-y-2 rounded-lg border border-zinc-200 bg-white p-3 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
    >
      <p className="text-xs text-zinc-500">{formatTime(entry.happenedAt)}</p>
      {entry.body && (
        <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed">
          {entry.body}
        </p>
      )}
      {shown.length > 0 && (
        <div className="flex gap-2">
          {shown.map((p) => (
            <img
              key={p.id}
              src={photoUrl(p.key)}
              alt=""
              loading="lazy"
              className="h-16 w-16 rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
            />
          ))}
          {hidden > 0 && (
            <span className="self-center text-xs text-zinc-500">+{hidden}</span>
          )}
        </div>
      )}
    </Link>
  );
}
