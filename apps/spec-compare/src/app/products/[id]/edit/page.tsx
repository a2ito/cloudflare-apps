import { notFound } from "next/navigation";
import { updateProduct } from "@/app/actions/products";
import { ProductForm } from "@/components/product-form";
import { getDb } from "@/db";
import { getProduct, getProductSpecs, listFields, listMakers } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { parseId } from "@/lib/params";

export default async function EditProductPage({ params }: PageProps<"/products/[id]/edit">) {
	await requireUser();
	const id = parseId((await params).id);
	if (id === null) notFound();

	const db = await getDb();
	const product = await getProduct(db, id);
	if (!product) notFound();
	const [fields, specs, makers] = await Promise.all([listFields(db, product.categoryId), getProductSpecs(db, id), listMakers(db)]);

	return (
		<div className="mx-auto max-w-2xl space-y-4">
			<h1 className="text-xl font-bold">商品を編集</h1>
			<ProductForm action={updateProduct} categoryId={product.categoryId} fields={fields} makers={makers} stores={[]} product={product} specs={specs} />
		</div>
	);
}
