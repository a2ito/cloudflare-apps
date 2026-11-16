import Link from "next/link";
import { notFound } from "next/navigation";
import { NetworkNameForm } from "@/components/network-name-form";
import { SeriesView } from "@/components/series-view";
import { getDb } from "@/db";
import { getNetwork } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { parseRange } from "@/lib/limits";

export default async function NetworkPage({
  params,
  searchParams,
}: PageProps<"/networks/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const networkId = Number(id);
  if (!Number.isInteger(networkId) || networkId <= 0) notFound();

  const db = await getDb();
  // 他人のネットワークの ID を開かれても、無いものとして扱う
  const network = await getNetwork(db, user.id, networkId);
  if (!network) notFound();

  const rangeKey = parseRange((await searchParams).range);

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← 一覧
      </Link>
      <div className="space-y-1">
        <h1 className="text-xl font-bold">{network.name}</h1>
        <p className="text-sm text-zinc-500">
          SSID {network.ssid} ・ このネットワークにつないだ全端末の計測の平均
        </p>
      </div>
      <NetworkNameForm networkId={network.id} name={network.name} />

      <SeriesView
        db={db}
        target={{ networkId: network.id }}
        rangeKey={rangeKey}
        basePath={`/networks/${network.id}`}
        now={new Date()}
      />
    </main>
  );
}
