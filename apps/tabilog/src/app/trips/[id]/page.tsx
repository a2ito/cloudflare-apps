import Link from "next/link";
import { notFound } from "next/navigation";
import { Rating } from "@/components/rating";
import { LinkPending } from "@/components/link-pending";
import { LinkButton } from "@/components/ui";
import { getDb } from "@/db";
import { getTrip, listEntries } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { formatDateRange, formatWallClock } from "@/lib/datetime";
import {
  ENTRY_KIND_OPTIONS,
  entryKindEmoji,
  entryKindLabel,
  entryKindName,
  isEntryKind,
} from "@/lib/entry-kinds";
import {
  amountToJpy,
  DEFAULT_CURRENCY,
  formatJpy,
  formatMoney,
  needsJpyConversion,
  sumAsJpy,
  sumByCurrency,
  toRates,
} from "@/lib/money";
import { photoUrl } from "@/lib/photos";

const FILTERS = [
  { key: "", label: "すべて" },
  ...ENTRY_KIND_OPTIONS.map((k) => ({ key: k.value, label: k.label })),
];

export default async function TripPage({
  params,
  searchParams,
}: PageProps<"/trips/[id]">) {
  await requireUser();
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId)) notFound();

  const db = await getDb();
  const trip = await getTrip(db, tripId);
  if (!trip) notFound();

  const query = await searchParams;
  const kind =
    typeof query.kind === "string" && isEntryKind(query.kind)
      ? query.kind
      : undefined;
  const minRating =
    typeof query.rating === "string" ? Number(query.rating) : undefined;
  const areaId =
    typeof query.area === "string" ? Number(query.area) : undefined;
  // 他の旅行のエリア ID を渡されても効かないようにする
  const activeArea = trip.areas.find((a) => a.id === areaId);
  const entries = await listEntries(db, tripId, {
    kind,
    areaId: activeArea?.id,
    minRating:
      Number.isInteger(minRating) && minRating! >= 1 && minRating! <= 5
        ? minRating
        : undefined,
  });

  // 記録ごとに通貨が違いうるので、合計は主通貨の円で出し、内訳を通貨ごとに添える
  const rates = toRates(trip.currencies);
  const areaNames = new Map(trip.areas.map((a) => [a.id, a.name]));
  const amounts = entries
    .filter((e) => e.amountMinor !== null)
    .map((e) => ({
      minor: e.amountMinor as number,
      currency: e.amountCurrency ?? DEFAULT_CURRENCY,
    }));
  const totalJpy = sumAsJpy(amounts, rates);
  const byCurrency = sumByCurrency(amounts);
  const filterHref = (k: string) => {
    const params = new URLSearchParams();
    if (k) params.set("kind", k);
    if (minRating) params.set("rating", String(minRating));
    if (activeArea) params.set("area", String(activeArea.id));
    const qs = params.toString();
    return qs ? `/trips/${tripId}?${qs}` : `/trips/${tripId}`;
  };
  const areaHref = (a: number | null) => {
    const params = new URLSearchParams();
    if (kind) params.set("kind", kind);
    if (minRating) params.set("rating", String(minRating));
    if (a) params.set("area", String(a));
    const qs = params.toString();
    return qs ? `/trips/${tripId}?${qs}` : `/trips/${tripId}`;
  };
  const ratingHref = (r: number | null) => {
    const params = new URLSearchParams();
    if (kind) params.set("kind", kind);
    if (r) params.set("rating", String(r));
    if (activeArea) params.set("area", String(activeArea.id));
    const qs = params.toString();
    return qs ? `/trips/${tripId}?${qs}` : `/trips/${tripId}`;
  };

  // 畳んだままでも何で絞っているか分かるように、見出しへ並べる
  const activeFilters = [
    kind ? entryKindLabel(kind) : null,
    minRating ? `★${minRating} 以上` : null,
    activeArea ? `📍 ${activeArea.name}` : null,
  ].filter((v): v is string => v !== null);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← 旅行一覧
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{trip.name}</h1>
            <p className="text-sm text-zinc-500">
              {formatDateRange(trip.startDate, trip.endDate)}
            </p>
            {trip.currencies.length > 0 && (
              <p className="text-xs text-zinc-500">
                {trip.currencies
                  .map((c) => `1 ${c.code} = ${c.rateToJpy} 円`)
                  .join(" ・ ")}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <LinkButton href={`/trips/${trip.id}/edit`}>編集</LinkButton>
            <LinkButton
              href={`/trips/${trip.id}/entries/new`}
              variant="primary"
            >
              記録する
            </LinkButton>
          </div>
        </div>
        {trip.note && (
          <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
            {trip.note}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">
          表示中の {entries.length} 件の合計
        </p>
        <p className="text-2xl font-bold">{formatJpy(totalJpy)}</p>
        {/* 円だけの内訳なら合計と同じなので出さない */}
        {(byCurrency.length > 1 ||
          byCurrency.some((c) => c.currency !== DEFAULT_CURRENCY)) && (
          <p className="text-sm text-zinc-500">
            {byCurrency
              .map((c) => formatMoney(c.minor, c.currency))
              .join(" ・ ")}
          </p>
        )}
      </div>

      {/*
				チップを常に並べると記録が押し出されるので畳んでおく。
				何かで絞っている間は開いたままにして、戻し方が見えるようにする
			*/}
      <details
        open={activeFilters.length > 0}
        className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      >
        <summary className="cursor-pointer px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400">
          絞り込み
          {activeFilters.length > 0 && (
            <span className="ml-1 font-medium text-zinc-900 dark:text-zinc-100">
              {activeFilters.join(" ・ ")}
            </span>
          )}
        </summary>

        <div className="space-y-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex flex-wrap gap-2 text-sm">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={filterHref(f.key)}
                className={`rounded-full border px-3 py-1 ${
                  (kind ?? "") === f.key
                    ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                    : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                }`}
              >
                {f.label}
              </Link>
            ))}
            <Link
              href={ratingHref(minRating === 4 ? null : 4)}
              className={`rounded-full border px-3 py-1 ${
                minRating === 4
                  ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              }`}
            >
              ★4 以上
            </Link>
          </div>

          {trip.areas.length > 0 && (
            <div className="flex flex-wrap gap-2 text-sm">
              {[{ id: 0, name: "すべてのエリア" }, ...trip.areas].map(
                (area) => (
                  <Link
                    key={area.id}
                    href={areaHref(area.id === 0 ? null : area.id)}
                    className={`rounded-full border px-3 py-1 ${
                      (activeArea?.id ?? 0) === area.id
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                    }`}
                  >
                    {area.id === 0 ? area.name : `📍 ${area.name}`}
                  </Link>
                ),
              )}
            </div>
          )}
        </div>
      </details>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          記録がありません
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link
                href={`/trips/${trip.id}/entries/${entry.id}`}
                className="flex gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition hover:border-sky-400 dark:border-zinc-800 dark:bg-zinc-950"
              >
                {entry.photos[0] ? (
                  <img
                    src={photoUrl(entry.photos[0].key)}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
                  />
                ) : (
                  // 写真が無いカードだけ左端が欠けて見えるので、種別の絵を置いて幅をそろえる
                  <div
                    aria-hidden="true"
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-xl dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {entryKindEmoji(entry.kind)}
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <h2 className="flex items-center gap-1 text-sm font-semibold">
                    {/* 折り返して 2 行になるより、幅いっぱいに出して続きを詰める方が一覧として読みやすい */}
                    <span className="min-w-0 truncate">
                      {/* 並べると同じ言葉が続いて読みにくいので、一覧では絵文字だけにする */}
                      <span
                        className="mr-1"
                        role="img"
                        aria-label={entryKindName(entry.kind)}
                        title={entryKindName(entry.kind)}
                      >
                        {entryKindEmoji(entry.kind)}
                      </span>
                      {entry.title}
                    </span>
                    {/* 押したカードが反応するように、遷移待ちの間だけぐるぐるを出す */}
                    <span className="shrink-0">
                      <LinkPending />
                    </span>
                  </h2>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                    <span>{formatWallClock(entry.happenedAt)}</span>
                    <Rating value={entry.rating} />
                    {entry.commentCount > 0 && (
                      <span>💬 {entry.commentCount}</span>
                    )}
                  </p>
                  {/* 日時と混ざって読みにくかったので、店名は独立した行にする */}
                  {(entry.place || entry.areaId) && (
                    <p className="flex items-center gap-1 text-xs text-zinc-500">
                      <span aria-hidden="true">📍</span>
                      <span className="truncate">
                        {[areaNames.get(entry.areaId ?? 0), entry.place]
                          .filter(Boolean)
                          .join(" ・ ")}
                      </span>
                    </p>
                  )}
                </div>
                {/* 金額は右上に固定する。行に混ぜると題名の長さで位置が動く */}
                {entry.amountMinor != null && (
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium">
                      {formatMoney(
                        entry.amountMinor,
                        entry.amountCurrency ?? DEFAULT_CURRENCY,
                      )}
                    </p>
                    {/* 現地通貨で入れた記録にも円を添える。円で入れた記録は上の行がそのまま円 */}
                    {needsJpyConversion(
                      entry.amountCurrency ?? DEFAULT_CURRENCY,
                    ) && (
                      <p className="text-xs text-zinc-500">
                        約{" "}
                        {formatJpy(
                          amountToJpy(
                            {
                              minor: entry.amountMinor,
                              currency:
                                entry.amountCurrency ?? DEFAULT_CURRENCY,
                            },
                            rates,
                          ),
                        )}
                      </p>
                    )}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
