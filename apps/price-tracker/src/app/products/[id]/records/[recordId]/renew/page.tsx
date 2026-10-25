import { notFound } from "next/navigation";
import { createRecord } from "@/app/actions/records";
import { RecordForm } from "@/components/record-form";
import { getDb } from "@/db";
import { getProduct, getRecord, getVariant, listStores } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { formatPackage } from "@/lib/price";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * 同じ店の価格を更新する。元の記録は書き換えず、店舗などを引き継いだ新しい記録を足す。
 * 古い価格を残しておかないと最安値の更新履歴がたどれなくなるため
 */
export default async function RenewRecordPage({
  params,
}: PageProps<"/products/[id]/records/[recordId]/renew">) {
  await requireUser();
  const { id, recordId } = await params;
  const productId = parseId(id);
  const sourceId = parseId(recordId);
  if (productId === null || sourceId === null) notFound();

  const db = await getDb();
  const [product, record, stores] = await Promise.all([
    getProduct(db, productId),
    getRecord(db, sourceId),
    listStores(db),
  ]);
  if (!product || !record) notFound();
  const variant = await getVariant(db, record.variantId);
  // 別の商品の記録を引き継がせない
  if (!variant || variant.productId !== productId) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm text-zinc-500">
          {product.name}・
          {formatPackage(variant.amount, variant.count, product.unit)}
        </p>
        <h1 className="text-xl font-bold">{record.store} の価格を更新</h1>
        <p className="text-xs text-zinc-500">
          前回の記録は残したまま、新しい価格を記録します
        </p>
      </div>
      <RecordForm
        action={createRecord}
        productId={productId}
        variantId={variant.id}
        unit={product.unit}
        variant={variant}
        stores={stores}
        previous={record}
      />
    </div>
  );
}
