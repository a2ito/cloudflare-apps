import { notFound } from "next/navigation";
import { updateVariant } from "@/app/actions/variants";
import { VariantForm } from "@/components/variant-form";
import { getDb } from "@/db";
import { getProduct, getVariant } from "@/db/queries";
import { requireUser } from "@/lib/auth";

function parseId(raw: string): number | null {
	const n = Number(raw);
	return Number.isInteger(n) && n > 0 ? n : null;
}

export default async function EditVariantPage({ params }: PageProps<"/products/[id]/variants/[variantId]/edit">) {
	await requireUser();
	const { id, variantId } = await params;
	const productId = parseId(id);
	const targetId = parseId(variantId);
	if (productId === null || targetId === null) notFound();

	const db = await getDb();
	const [product, variant] = await Promise.all([getProduct(db, productId), getVariant(db, targetId)]);
	if (!product || !variant) notFound();
	// 別の商品の荷姿を編集させない
	if (variant.productId !== productId) notFound();

	return (
		<div className="mx-auto max-w-xl space-y-6">
			<div>
				<p className="text-sm text-zinc-500">{product.name}</p>
				<h1 className="text-xl font-bold">荷姿を編集</h1>
			</div>
			<VariantForm action={updateVariant} productId={productId} unit={product.unit} variant={variant} />
		</div>
	);
}
