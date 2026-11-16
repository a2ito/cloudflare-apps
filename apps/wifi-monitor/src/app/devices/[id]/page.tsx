import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteDeviceButton } from "@/components/delete-device-button";
import { SeriesView } from "@/components/series-view";
import { StatusBadge } from "@/components/status-badge";
import { getDb } from "@/db";
import { getDevice, getLatestSample, getNetwork } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { parseRange } from "@/lib/limits";
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
  const now = new Date();
  const latest = await getLatestSample(db, device.id);
  const network = latest?.networkId
    ? await getNetwork(db, user.id, latest.networkId)
    : null;

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← 一覧
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{device.name}</h1>
        <StatusBadge online={isOnline(device.lastSeenAt, now)} />
      </div>
      <p className="text-sm text-zinc-500">
        {device.lastSeenAt
          ? `最終受信 ${formatDateTime(new Date(device.lastSeenAt))}（${formatAgo(new Date(device.lastSeenAt), now)}）`
          : "まだ受信していません"}
        {network ? (
          <>
            {" ・ "}
            <Link
              href={`/networks/${network.id}`}
              className="text-sky-700 hover:underline dark:text-sky-400"
            >
              {network.name}
            </Link>
          </>
        ) : latest?.ssid ? (
          ` ・ SSID ${latest.ssid}`
        ) : (
          ""
        )}
      </p>

      <SeriesView
        db={db}
        target={{ deviceId: device.id }}
        rangeKey={rangeKey}
        basePath={`/devices/${device.id}`}
        now={now}
      />

      <DeleteDeviceButton deviceId={device.id} deviceName={device.name} />
    </main>
  );
}
