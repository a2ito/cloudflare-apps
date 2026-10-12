import { notFound } from "next/navigation";
import { updateRecord } from "@/app/actions/records";
import { RecordForm } from "@/components/record-form";
import { getDb } from "@/db";
import { getProduct, getRecord, listStores } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/date";
import { parseId } from "@/lib/params";

export default async function EditRecordPage({ params }: PageProps<"/products/[id]/records/[recordId]/edit">) {
	await requireUser();
	const p = await params;
	const productId = parseId(p.id);
	const recordId = parseId(p.recordId);
	if (productId === null || recordId === null) notFound();

	const db = await getDb();
	const [product, record, stores] = await Promise.all([getProduct(db, productId), getRecord(db, recordId), listStores(db)]);
	if (!product || !record || record.productId !== productId) notFound();

	return (
		<div className="mx-auto max-w-2xl space-y-4">
			<div>
				<p className="text-sm text-zinc-500">{product.name}</p>
				<h1 className="text-xl font-bold">価格の記録を編集</h1>
			</div>
			<RecordForm action={updateRecord} productId={productId} stores={stores} today={today()} record={record} />
		</div>
	);
}
