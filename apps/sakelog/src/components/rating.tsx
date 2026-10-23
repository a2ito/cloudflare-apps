import { MAX_RATING, RATING_AXES, type Ratings } from "@/lib/ratings";

/** 評価を ★ で表す。未評価なら null */
export function Rating({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  if (!value) return null;
  return (
    <span
      className={`text-amber-500 ${className ?? ""}`}
      title={`評価 ${value} / ${MAX_RATING}`}
    >
      <span aria-hidden="true">{"★".repeat(value)}</span>
      <span className="sr-only">
        評価 {value} / {MAX_RATING}
      </span>
    </span>
  );
}

/**
 * 軸ごとの評価。
 *
 * 付いていない軸は行ごと落とす（「未評価」の行が並ぶと、
 * 付けた評価が埋もれて読みにくい）。
 */
export function RatingAxes({ ratings }: { ratings: Ratings }) {
  const rated = RATING_AXES.filter((axis) => ratings[axis.key] !== null);
  if (rated.length === 0) return null;

  return (
    <dl className="grid gap-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-950">
      {rated.map((axis) => {
        const value = ratings[axis.key] ?? 0;
        return (
          <div
            key={axis.key}
            className="flex items-center justify-between gap-3"
          >
            <dt className="text-zinc-500">{axis.label}</dt>
            <dd className="flex items-center gap-2">
              {/* ★ だけだと 4 と 5 の差が読み取りづらいので数字も添える */}
              <Rating value={value} />
              <span className="tabular-nums text-xs text-zinc-500">
                {value} / {MAX_RATING}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
