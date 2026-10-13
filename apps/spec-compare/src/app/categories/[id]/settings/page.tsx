import Link from "next/link";
import { notFound } from "next/navigation";
import { DefaultCostForm, DeleteCategoryForm, RenameCategoryForm } from "@/components/category-forms";
import { FieldManager } from "@/components/field-manager";
import { getDb } from "@/db";
import { getCategory, listFields } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { parseId } from "@/lib/params";

export default async function CategorySettingsPage({ params }: PageProps<"/categories/[id]/settings">) {
	await requireUser();
	const id = parseId((await params).id);
	if (id === null) notFound();

	const db = await getDb();
	const [category, fields] = await Promise.all([getCategory(db, id), listFields(db, id)]);
	if (!category) notFound();

	return (
		<div className="mx-auto max-w-2xl space-y-8">
			<div>
				<Link href={`/categories/${id}`} className="text-sm text-zinc-500 hover:underline">
					← {category.name}の比較表
				</Link>
				<h1 className="text-xl font-bold">カテゴリの設定</h1>
			</div>

			<section className="space-y-2">
				<h2 className="font-semibold">名前</h2>
				<RenameCategoryForm category={category} />
			</section>

			<section className="space-y-2">
				<h2 className="font-semibold">スペック項目</h2>
				<p className="text-sm text-zinc-500">比較表の列になります。上にある項目ほど左に出ます。</p>
				<FieldManager categoryId={id} fields={fields} />
			</section>

			<section className="space-y-2">
				<h2 className="font-semibold">既定のコスパ</h2>
				<p className="text-sm text-zinc-500">比較表を開いたときに出すコスパ列です。比較表の「絞り込み・コスパ」で一時的に切り替えられます。</p>
				<DefaultCostForm category={category} fields={fields} />
			</section>

			<section className="space-y-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
				<h2 className="font-semibold">削除</h2>
				<p className="text-sm text-zinc-500">商品が残っているカテゴリは削除できません。</p>
				<DeleteCategoryForm category={category} />
			</section>
		</div>
	);
}
