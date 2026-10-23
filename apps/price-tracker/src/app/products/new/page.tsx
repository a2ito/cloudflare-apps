import { createProduct } from "@/app/actions/products";
import { ProductForm } from "@/components/product-form";
import { getDb } from "@/db";
import { listCategories, listMakers } from "@/db/queries";
import { requireUser } from "@/lib/auth";

export default async function NewProductPage() {
  await requireUser();
  const db = await getDb();
  const [categories, makers] = await Promise.all([
    listCategories(db),
    listMakers(db),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-xl font-bold">商品を登録</h1>
      <ProductForm
        action={createProduct}
        categories={categories}
        makers={makers}
      />
    </div>
  );
}
