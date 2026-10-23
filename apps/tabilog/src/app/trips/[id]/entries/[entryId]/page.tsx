import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentThreads } from "@/components/comment-thread";
import { PhotoGallery } from "@/components/photo-gallery";
import { Rating } from "@/components/rating";
import { LinkButton } from "@/components/ui";
import { getDb } from "@/db";
import { getEntry, getTrip, listComments } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { formatTimestamp, formatWallClock } from "@/lib/datetime";
import { entryKindLabel } from "@/lib/entry-kinds";
import { photoFileName } from "@/lib/photo-name";
import {
  amountToJpy,
  DEFAULT_CURRENCY,
  formatJpy,
  formatMoney,
  normalizeCurrency,
  toRates,
} from "@/lib/money";
import { photoUrl } from "@/lib/photos";

export default async function EntryPage({
  params,
}: PageProps<"/trips/[id]/entries/[entryId]">) {
  const user = await requireUser();
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
  const comments = await listComments(db, entry.id);

  const authorName = entry.author.name ?? entry.author.email;
  // photoUrl は Cloudflare の env に触れるモジュールにあるので、URL はここで作って渡す
  const galleryPhotos = entry.photos.map((photo, index) => ({
    id: photo.id,
    src: photoUrl(photo.key),
    downloadName: photoFileName(entry.title, index, photo.contentType),
  }));
  const entryCurrency = entry.amountCurrency ?? DEFAULT_CURRENCY;
  const areaName = trip.areas.find((a) => a.id === entry.areaId)?.name;

  return (
    <div className="space-y-6">
      <Link
        href={`/trips/${trip.id}`}
        className="text-sm text-zinc-500 hover:underline"
      >
        ← {trip.name}
      </Link>

      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-500">
              {entryKindLabel(entry.kind)}
            </p>
            <h1 className="text-2xl font-bold">{entry.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-zinc-500">
              <span>{formatWallClock(entry.happenedAt)}</span>
              {/* 旅行に登録したエリア（ミラノなど）。店名より粗い単位で、絞り込みにも使う */}
              {areaName && <span>・📍 {areaName}</span>}
              {entry.place && <span>・{entry.place}</span>}
              <Rating value={entry.rating} />
            </p>
            {/* 保存時に Google マップの URL だけを通しているが、外部リンクなので参照元は渡さない */}
            {entry.mapUrl && (
              <a
                href={entry.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm text-sky-600 hover:underline dark:text-sky-400"
              >
                🗺️ 地図で見る
              </a>
            )}
          </div>
          <LinkButton href={`/trips/${trip.id}/entries/${entry.id}/edit`}>
            編集
          </LinkButton>
        </div>

        {entry.amountMinor != null && (
          <p className="text-xl font-bold">
            {formatMoney(entry.amountMinor, entryCurrency)}
            {/* 円で入力された記録に円換算を添えても意味がない */}
            {normalizeCurrency(entryCurrency) !== DEFAULT_CURRENCY && (
              <span className="ml-2 text-sm font-normal text-zinc-500">
                約{" "}
                {formatJpy(
                  amountToJpy(
                    { minor: entry.amountMinor, currency: entryCurrency },
                    toRates(trip.currencies),
                  ),
                )}
              </span>
            )}
          </p>
        )}

        <p className="text-xs text-zinc-500">
          {authorName} が {formatTimestamp(entry.createdAt)} に記録
          {entry.updatedAt !== entry.createdAt &&
            `（最終更新 ${formatTimestamp(entry.updatedAt)}）`}
        </p>

        {entry.note && (
          <p className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
            {entry.note}
          </p>
        )}
      </div>

      {entry.photos.length > 0 && <PhotoGallery photos={galleryPhotos} />}

      <section className="space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="font-semibold">コメント（{comments.length}）</h2>
        <CommentThreads
          entryId={entry.id}
          comments={comments}
          currentUserId={user.id}
        />
      </section>
    </div>
  );
}
