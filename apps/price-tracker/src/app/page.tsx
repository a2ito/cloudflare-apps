import Link from "next/link";
import { getDb } from "@/db";
import { listCategories, listProducts, type ProductListItem, type VariantWithBest } from "@/db/queries";
import type { Unit } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { imageUrl } from "@/lib/images";
import { formatAmount, formatPackage, formatYen, packageAmount, unitBaseLabel, unitPrice } from "@/lib/price";
import { inputClass } from "@/components/ui";

function parseCategoryId(value: string | string[] | undefined): number | undefined {
	if (typeof value !== "string" || value === "") return undefined;
	const n = Number(value);
	return Number.isInteger(n) && n > 0 ? n : undefined;
}

function VariantRow({ variant, unit }: { variant: VariantWithBest; unit: Unit }) {
	const best = variant.best;
	return (
		<li className="py-1.5">
			<p className="truncate text-xs text-zinc-500">{formatPackage(variant.amount, variant.count, unit)}</p>
			{best ? (
				<>
					<p className="flex flex-wrap items-baseline gap-x-2">
						<span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
							{formatYen(unitPrice({ price: best.price, amount: variant.amount, count: variant.count, quantity: best.quantity, unit }))}
							<span className="ml-0.5 text-xs font-normal text-zinc-500">/ {unitBaseLabel(unit)}</span>
						</span>
						<span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
							{formatYen(best.price, 0)}
							<span className="ml-0.5 text-xs font-normal text-zinc-500">
								/ {formatAmount(packageAmount(variant.amount, variant.count), best.quantity, unit)}
							</span>
						</span>
					</p>
					<p className="truncate text-xs text-zinc-500">
						{best.store} ・ {best.recordedAt}
					</p>
				</>
			) : (
				<p className="text-sm text-zinc-400">価格未登録</p>
			)}
		</li>
	);
}

function ProductCard({ item }: { item: ProductListItem }) {
	return (
		<Link
			href={`/products/${item.id}`}
			className="flex gap-4 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition hover:border-emerald-400 hover:shadow dark:border-zinc-800 dark:bg-zinc-950"
		>
			<div className="h-20 w-20 flex-none overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
				{item.imageKey ? (
					<img src={imageUrl(item.imageKey)} alt={item.name} className="h-full w-full object-contain" loading="lazy" />
				) : (
					<div className="flex h-full w-full items-center justify-center text-2xl text-zinc-400">📦</div>
				)}
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate text-xs text-zinc-500">
					{item.categoryName ?? "未分類"}
					{item.maker && <span className="ml-1 text-zinc-400">・{item.maker}</span>}
				</p>
				<h2 className="truncate font-semibold">{item.name}</h2>
				{/* 最安値は荷姿ごとに判定する。大容量のまとめ買いが常に勝って比較にならないのを避けるため */}
				{item.variants.length === 0 ? (
					<p className="mt-1 text-sm text-zinc-400">荷姿未登録</p>
				) : (
					<ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
						{item.variants.map((v) => (
							<VariantRow key={v.id} variant={v} unit={item.unit} />
						))}
					</ul>
				)}
			</div>
		</Link>
	);
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
	await requireUser();
	const params = await searchParams;
	const categoryId = parseCategoryId(params.category);
	const query = typeof params.q === "string" && params.q.trim() !== "" ? params.q.trim() : undefined;

	const db = await getDb();
	const [categories, items] = await Promise.all([listCategories(db), listProducts(db, { categoryId, query })]);

	const chip = (active: boolean) =>
		`rounded-full px-3 py-1 text-sm ${
			active
				? "bg-emerald-600 text-white"
				: "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
		}`;
	const withQuery = (cat?: number) => {
		const sp = new URLSearchParams();
		if (cat !== undefined) sp.set("category", String(cat));
		if (query) sp.set("q", query);
		const s = sp.toString();
		return s ? `/?${s}` : "/";
	};

	return (
		<div className="space-y-5">
			<form className="flex gap-2">
				{categoryId !== undefined && <input type="hidden" name="category" value={categoryId} />}
				<input name="q" defaultValue={query ?? ""} placeholder="商品名で検索" className={inputClass} />
				<button type="submit" className="rounded-md border border-zinc-300 px-4 text-sm whitespace-nowrap hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
					検索
				</button>
			</form>

			<div className="flex flex-wrap gap-2">
				<Link href={withQuery()} className={chip(categoryId === undefined)}>
					すべて
				</Link>
				{categories.map((c) => (
					<Link key={c.id} href={withQuery(c.id)} className={chip(categoryId === c.id)}>
						{c.name}
					</Link>
				))}
			</div>

			{items.length === 0 ? (
				<div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
					<p>商品がまだありません</p>
					<Link href="/products/new" className="mt-2 inline-block font-medium text-emerald-700 hover:underline dark:text-emerald-400">
						最初の商品を登録する
					</Link>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					{items.map((item) => (
						<ProductCard key={item.id} item={item} />
					))}
				</div>
			)}
		</div>
	);
}
