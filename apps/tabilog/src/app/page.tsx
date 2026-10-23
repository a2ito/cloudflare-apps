import Link from "next/link";
import { LinkPending } from "@/components/link-pending";
import { LinkButton } from "@/components/ui";
import { getDb } from "@/db";
import { listTrips } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { formatDateRange } from "@/lib/datetime";
import { formatJpy, sumAsJpy, toRates } from "@/lib/money";

export default async function HomePage() {
  await requireUser();
  const db = await getDb();
  const trips = await listTrips(db);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">旅行</h1>
        <LinkButton href="/trips/new" variant="primary">
          旅行をつくる
        </LinkButton>
      </div>

      {trips.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          まだ旅行がありません。最初の旅行をつくりましょう
        </p>
      ) : (
        <ul className="space-y-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link
                href={`/trips/${trip.id}`}
                className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-sky-400 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    {trip.name}
                    {/* 押したカードが反応するように、遷移待ちの間だけぐるぐるを出す */}
                    <LinkPending />
                  </h2>
                  <span className="text-sm text-zinc-500">
                    {formatDateRange(trip.startDate, trip.endDate)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {/* 通貨が混ざりうるので、合計は主通貨の円に寄せて出す */}
                  {trip.entryCount} 件の記録 ・ 合計{" "}
                  {formatJpy(sumAsJpy(trip.amounts, toRates(trip.currencies)))}
                  {trip.currencies.length > 0 && (
                    <span className="text-zinc-500">
                      {" "}
                      ・ {trip.currencies.map((c) => c.code).join(" / ")}
                    </span>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
