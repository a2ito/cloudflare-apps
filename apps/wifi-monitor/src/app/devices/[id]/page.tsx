import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteDeviceButton } from "@/components/delete-device-button";
import { LineChart } from "@/components/line-chart";
import { StatusBadge } from "@/components/status-badge";
import { getDb } from "@/db";
import { getDevice, getLatestSample, getSeries } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { parseRange, RANGES } from "@/lib/limits";
import { isOnline } from "@/lib/status";
import { formatAgo, formatDateTime } from "@/lib/time";

export default async function DevicePage({
  params,
  searchParams,
}: PageProps<"/devices/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId <= 0) notFound();

  const db = await getDb();
  // 他人の端末の ID を開かれても、無いものとして扱う
  const device = await getDevice(db, user.id, deviceId);
  if (!device) notFound();

  const rangeKey = parseRange((await searchParams).range);
  const range = RANGES[rangeKey];
  const now = new Date();
  const to = Math.floor(now.getTime() / 1000);
  const from = to - range.seconds;
  const [series, latest] = await Promise.all([
    getSeries(
      db,
      device.id,
      new Date(from * 1000).toISOString(),
      range.bucketSeconds,
    ),
    getLatestSample(db, device.id),
  ]);

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
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← 端末一覧
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{device.name}</h1>
        <StatusBadge online={isOnline(device.lastSeenAt, now)} />
      </div>
      <p className="text-sm text-zinc-500">
        {device.lastSeenAt
          ? `最終受信 ${formatDateTime(new Date(device.lastSeenAt))}（${formatAgo(new Date(device.lastSeenAt), now)}）`
          : "まだ受信していません"}
        {latest?.ssid ? ` ・ SSID ${latest.ssid}` : ""}
      </p>

      <nav className="flex gap-2 text-sm" aria-label="期間">
        {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((key) => (
          <Link
            key={key}
            href={`/devices/${device.id}?range=${key}`}
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

      <DeleteDeviceButton deviceId={device.id} deviceName={device.name} />
    </main>
  );
}
