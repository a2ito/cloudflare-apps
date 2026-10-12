import Link from "next/link";
import { CreateCategoryForm } from "@/components/category-forms";
import { getDb } from "@/db";
import { listCategories } from "@/db/queries";
import { requireUser } from "@/lib/auth";

export default async function HomePage() {
	await requireUser();
	const db = await getDb();
	const categories = await listCategories(db);

	return (
		<div className="space-y-8">
			<section className="space-y-3">
				<h1 className="text-xl font-bold">カテゴリ</h1>
				{categories.length === 0 ? (
					<p className="text-sm text-zinc-500">
						まずは比べたいもののカテゴリ（ノート PC、モニターなど）を作ってください。カテゴリごとに比べるスペック項目を決められます。
					</p>
				) : (
					<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{categories.map((c) => (
							<li key={c.id}>
								<Link
									href={`/categories/${c.id}`}
									className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-indigo-400 hover:shadow dark:border-zinc-800 dark:bg-zinc-950"
								>
									<h2 className="truncate font-semibold">{c.name}</h2>
									<p className="mt-1 text-sm text-zinc-500">
										商品 {c.productCount} 件 ・ スペック項目 {c.fieldCount} 個
									</p>
								</Link>
							</li>
						))}
					</ul>
				)}
			</section>

			<section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
				<h2 className="font-semibold">カテゴリを作る</h2>
				<CreateCategoryForm />
			</section>
		</div>
	);
}
