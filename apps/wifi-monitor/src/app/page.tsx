import Link from "next/link";
import { DeviceForm } from "@/components/device-form";
import { StatusBadge } from "@/components/status-badge";
import { getDb } from "@/db";
import { listDevicesWithLatest } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { getEnv, requireEnvString } from "@/lib/cloudflare";
import { isOnline } from "@/lib/status";
import { formatAgo } from "@/lib/time";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function fmt(v: number | null, unit: string, digits = 0): string {
  return v === null ? "—" : `${v.toFixed(digits)} ${unit}`;
}

export default async function HomePage() {
  const user = await requireUser();
  const [devices, env] = await Promise.all([
    getDb().then((db) => listDevicesWithLatest(db, user.id)),
    getEnv(),
  ]);
  const now = new Date();

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <section className="space-y-3">
        <h1 className="text-xl font-bold">端末</h1>
        {devices.length === 0 ? (
          <p className="text-sm text-zinc-500">
            まだ端末がありません。下で登録して、エージェントにトークンを設定してください。
          </p>
        ) : (
          <ul className="space-y-2">
            {devices.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/devices/${d.id}`}
                  className="block space-y-2 rounded-lg border border-zinc-200 bg-white p-4 hover:border-sky-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-sky-700"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{d.name}</span>
                    <StatusBadge online={isOnline(d.lastSeenAt, now)} />
                  </div>
                  <p className="text-xs text-zinc-500">
                    {d.lastSeenAt
                      ? `最終受信 ${formatAgo(new Date(d.lastSeenAt), now)}`
                      : "まだ受信していません"}
                    {d.latest?.ssid ? ` ・ ${d.latest.ssid}` : ""}
                  </p>
                  {d.latest && (
                    <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <Metric
                        label="受信強度"
                        value={fmt(d.latest.rssi, "dBm")}
                      />
                      <Metric
                        label="遅延"
                        value={fmt(d.latest.latencyMs, "ms", 1)}
                      />
                      <Metric
                        label="パケット損失"
                        value={fmt(d.latest.packetLossPct, "%", 1)}
                      />
                      <Metric
                        label="リンク速度"
                        value={fmt(d.latest.txRateMbps, "Mbps")}
                      />
                    </dl>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">端末を登録</h2>
        <DeviceForm apiOrigin={requireEnvString(env, "BETTER_AUTH_URL")} />
      </section>
    </main>
  );
}
