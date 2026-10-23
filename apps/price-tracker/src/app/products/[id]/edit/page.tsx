import { notFound } from "next/navigation";
import { updateProduct } from "@/app/actions/products";
import { ProductForm } from "@/components/product-form";
import { getDb } from "@/db";
import { getProduct, listCategories, listMakers } from "@/db/queries";
import { requireUser } from "@/lib/auth";

export default async function EditProductPage({
  params,
}: PageProps<"/products/[id]/edit">) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const db = await getDb();
  const [product, categories, makers] = await Promise.all([
    getProduct(db, id),
    listCategories(db),
    listMakers(db),
  ]);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-xl font-bold">商品を編集</h1>
      <ProductForm
        action={updateProduct}
        categories={categories}
        makers={makers}
        product={product}
      />
    </div>
  );
}
