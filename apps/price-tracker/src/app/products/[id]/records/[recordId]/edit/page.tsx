import { notFound } from "next/navigation";
import { updateRecord } from "@/app/actions/records";
import { RecordForm } from "@/components/record-form";
import { getDb } from "@/db";
import { getProduct, getRecord, getVariant, listStores } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { formatPackage, packageAmount } from "@/lib/price";

function parseId(raw: string): number | null {
	const n = Number(raw);
	return Number.isInteger(n) && n > 0 ? n : null;
}

export default async function EditRecordPage({ params }: PageProps<"/products/[id]/records/[recordId]/edit">) {
	await requireUser();
	const { id, recordId } = await params;
	const productId = parseId(id);
	const targetId = parseId(recordId);
	if (productId === null || targetId === null) notFound();

	const db = await getDb();
	const [product, record, stores] = await Promise.all([getProduct(db, productId), getRecord(db, targetId), listStores(db)]);
	if (!product || !record) notFound();
	const variant = await getVariant(db, record.variantId);
	// 別の商品の記録を編集させない
	if (!variant || variant.productId !== productId) notFound();

	return (
		<div className="mx-auto max-w-xl space-y-6">
			<div>
				<p className="text-sm text-zinc-500">
					{product.name}・{formatPackage(variant.amount, variant.count, product.unit)}
				</p>
				<h1 className="text-xl font-bold">価格記録を編集</h1>
			</div>
			<RecordForm
				action={updateRecord}
				productId={productId}
				variantId={variant.id}
				unit={product.unit}
				amount={packageAmount(variant.amount, variant.count)}
				stores={stores}
				record={record}
			/>
		</div>
	);
}
