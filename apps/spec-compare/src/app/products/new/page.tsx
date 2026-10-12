import Link from "next/link";
import { notFound } from "next/navigation";
import { createProduct } from "@/app/actions/products";
import { ProductForm } from "@/components/product-form";
import { getDb } from "@/db";
import { getCategory, listFields, listMakers, listStores } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { parseId } from "@/lib/params";

export default async function NewProductPage({ searchParams }: PageProps<"/products/new">) {
	await requireUser();
	// スペック項目はカテゴリが決めるので、どのカテゴリに足すかを必ず受け取る
	const categoryId = parseId((await searchParams).category);
	if (categoryId === null) notFound();

	const db = await getDb();
	const [category, fields, makers, stores] = await Promise.all([getCategory(db, categoryId), listFields(db, categoryId), listMakers(db), listStores(db)]);
	if (!category) notFound();

	return (
		<div className="mx-auto max-w-2xl space-y-4">
			<div>
				<Link href={`/categories/${categoryId}`} className="text-sm text-zinc-500 hover:underline">
					← {category.name}
				</Link>
				<h1 className="text-xl font-bold">商品を追加</h1>
			</div>
			<ProductForm action={createProduct} categoryId={categoryId} fields={fields} makers={makers} stores={stores} />
		</div>
	);
}
