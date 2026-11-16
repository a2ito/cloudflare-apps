import Link from "next/link";
import { LineChart } from "@/components/line-chart";
import type { Db } from "@/db";
import { getSeries, type SeriesTarget } from "@/db/queries";
import { RANGES, type RangeKey } from "@/lib/limits";

/**
 * 期間の切り替えと計測のグラフ。端末の画面とネットワークの画面で共通に使う。
 * target が持ち主のものかは呼び出し側で確かめておく。
 */
export async function SeriesView({
  db,
  target,
  rangeKey,
  basePath,
  now,
}: {
  db: Db;
  target: SeriesTarget;
  rangeKey: RangeKey;
  /** 期間の切り替えのリンク先（?range= を付ける） */
  basePath: string;
  now: Date;
}) {
  const range = RANGES[rangeKey];
  const to = Math.floor(now.getTime() / 1000);
  const from = to - range.seconds;
  const series = await getSeries(
    db,
    target,
    new Date(from * 1000).toISOString(),
    range.bucketSeconds,
  );

  const common = {
    from,
    to,
    // 1 区間抜けただけなら線をつなぐ。2 区間以上計測が無ければ途切れとして切る
    maxGap: range.bucketSeconds * 2,
    tickAsDay: rangeKey === "7d",
  };
  const pick = (
    key: "rssi" | "latencyMs" | "packetLossPct" | "downloadMbps" | "txRateMbps",
  ) => series.map((p) => ({ t: p.t, v: p[key] }));

  return (
    <>
      <nav className="flex gap-2 text-sm" aria-label="期間">
        {(Object.keys(RANGES) as RangeKey[]).map((key) => (
          <Link
            key={key}
            href={`${basePath}?range=${key}`}
            aria-current={key === rangeKey ? "page" : undefined}
            className={
              key === rangeKey
                ? "rounded-md bg-sky-600 px-3 py-1 font-semibold text-white"
                : "rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            }
          >
            {RANGES[key].label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-3">
        <LineChart
          {...common}
          title="遅延"
          unit="ms"
          digits={1}
          includeZero
          points={pick("latencyMs")}
          colorClass="text-sky-500"
        />
        <LineChart
          {...common}
          title="パケット損失"
          unit="%"
          digits={1}
          includeZero
          points={pick("packetLossPct")}
          colorClass="text-red-500"
        />
        <LineChart
          {...common}
          title="受信強度"
          unit="dBm"
          points={pick("rssi")}
          colorClass="text-emerald-500"
        />
        <LineChart
          {...common}
          title="リンク速度"
          unit="Mbps"
          includeZero
          points={pick("txRateMbps")}
          colorClass="text-violet-500"
        />
        <LineChart
          {...common}
          title="ダウンロード速度"
          unit="Mbps"
          digits={1}
          includeZero
          // 速度は低頻度でしか計測しないので、区間が空いても線をつなぐ
          maxGap={range.seconds}
          points={pick("downloadMbps")}
          colorClass="text-amber-500"
        />
      </div>
    </>
  );
}
