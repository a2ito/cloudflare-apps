import { toSegments, valueDomain, type ChartPoint } from "@/lib/chart";
import { formatDay, formatTime } from "@/lib/time";

const WIDTH = 600;
const HEIGHT = 160;
const PAD = { top: 8, right: 8, bottom: 22, left: 44 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

type Props = {
  title: string;
  unit: string;
  points: readonly ChartPoint[];
  /** 表示する期間（UNIX 秒） */
  from: number;
  to: number;
  /** これより点の間が空いたら線を切る（秒） */
  maxGap: number;
  /** 0 を必ず範囲に入れる（速度・損失率など、0 からの高さに意味があるもの） */
  includeZero?: boolean;
  /** 日をまたぐ期間なら目盛りを日付にする */
  tickAsDay?: boolean;
  /** 線の色（Tailwind の text-* クラス。SVG では currentColor で使う） */
  colorClass: string;
  digits?: number;
};

/**
 * 時系列の折れ線グラフ。サーバで SVG を描くだけで、クライアントの JS を持たない。
 */
export function LineChart({
  title,
  unit,
  points,
  from,
  to,
  maxGap,
  includeZero,
  tickAsDay,
  colorClass,
  digits = 0,
}: Props) {
  const values = points.map((p) => p.v).filter((v): v is number => v !== null);
  const domain = valueDomain(values, { includeZero });
  const latest = [...points].reverse().find((p) => p.v !== null)?.v ?? null;

  const x = (t: number) => PAD.left + ((t - from) / (to - from)) * PLOT_W;
  const y = (v: number, [lo, hi]: [number, number]) =>
    PAD.top + (1 - (v - lo) / (hi - lo)) * PLOT_H;

  const xTicks = Array.from(
    { length: 5 },
    (_, i) => from + ((to - from) * i) / 4,
  );

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-sm tabular-nums text-zinc-500">
          {latest === null ? "—" : `${latest.toFixed(digits)} ${unit}`}
        </span>
      </div>
      {domain === null ? (
        <p className="py-10 text-center text-sm text-zinc-500">
          この期間の計測がありません
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${title}の推移（${Math.min(...values).toFixed(digits)}〜${Math.max(...values).toFixed(digits)} ${unit}）`}
        >
          {[domain[0], (domain[0] + domain[1]) / 2, domain[1]].map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(v, domain)}
                y2={y(v, domain)}
                className="stroke-zinc-200 dark:stroke-zinc-800"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={y(v, domain)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-zinc-500 text-[10px] tabular-nums"
              >
                {v.toFixed(digits)}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text
              key={t}
              x={x(t)}
              y={HEIGHT - 6}
              // 両端は中央揃えだと描画範囲からはみ出して切れるので、内側に寄せる
              textAnchor={
                i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"
              }
              className="fill-zinc-500 text-[10px] tabular-nums"
            >
              {(tickAsDay ? formatDay : formatTime)(new Date(t * 1000))}
            </text>
          ))}
          <g className={colorClass}>
            {toSegments(points, maxGap).map((segment) =>
              segment.length === 1 ? (
                <circle
                  key={segment[0]!.t}
                  cx={x(segment[0]!.t)}
                  cy={y(segment[0]!.v, domain)}
                  r={1.5}
                  fill="currentColor"
                />
              ) : (
                <polyline
                  key={segment[0]!.t}
                  points={segment
                    .map(
                      (p) =>
                        `${x(p.t).toFixed(1)},${y(p.v, domain).toFixed(1)}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
              ),
            )}
          </g>
        </svg>
      )}
    </section>
  );
}
