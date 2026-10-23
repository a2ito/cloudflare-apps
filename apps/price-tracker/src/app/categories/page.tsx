import { CategoryManager } from "@/components/category-manager";
import { getDb } from "@/db";
import { listCategories } from "@/db/queries";
import { requireUser } from "@/lib/auth";

export default async function CategoriesPage() {
  await requireUser();
  const db = await getDb();
  const categories = await listCategories(db);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-xl font-bold">カテゴリ管理</h1>
      <CategoryManager categories={categories} />
    </div>
  );
}
