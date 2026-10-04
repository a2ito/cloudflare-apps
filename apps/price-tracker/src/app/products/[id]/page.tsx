import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProduct, mergeProduct } from "@/app/actions/products";
import { createRecord, deleteRecord } from "@/app/actions/records";
import { createVariant, deleteVariant } from "@/app/actions/variants";
import { RecordForm } from "@/components/record-form";
import { VariantForm } from "@/components/variant-form";
import { ConfirmForm, DangerButton, inputClass, LinkButton } from "@/components/ui";
import { getDb } from "@/db";
import { getProduct, listMergeTargets, listRecords, listStores, listVariants } from "@/db/queries";
import type { PriceRecord, Product, Variant } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { imageUrl } from "@/lib/images";
import { formatAmount, formatPackage, formatYen, packageAmount, unitBaseLabel, unitPrice } from "@/lib/price";
import { isSafeExternalUrl, linkHostname } from "@/lib/url";

/** リンクがあれば店舗名を外部リンクにする。危険な形式は素のテキストに落とす */
function StoreLabel({ store, url }: { store: string; url: string | null }) {
	if (!isSafeExternalUrl(url)) return <>{store}</>;
	return (
		<a
			href={url as string}
			target="_blank"
			rel="noopener noreferrer nofollow"
			title={linkHostname(url) ?? undefined}
			className="inline-flex items-center gap-1 text-emerald-700 underline underline-offset-2 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
		>
			{store}
			<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
				<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
				<path d="M15 3h6v6M10 14 21 3" />
			</svg>
		</a>
	);
}

function parseId(raw: string): number | null {
	const n = Number(raw);
	return Number.isInteger(n) && n > 0 ? n : null;
}

type VariantSectionProps = {
	product: Product;
	variant: Variant;
	records: PriceRecord[];
	stores: string[];
	/** 最後の荷姿は消させない */
	deletable: boolean;
	/** 記録フォームを最初から開いておくか */
	formOpen: boolean;
};

function VariantSection({ product, variant, records, stores, deletable, formOpen }: VariantSectionProps) {
	const best = records[0];
	const total = packageAmount(variant.amount, variant.count);
	const perUnit = (r: PriceRecord) =>
		unitPrice({ price: r.price, amount: variant.amount, count: variant.count, quantity: r.quantity, unit: product.unit });

	return (
		<section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="text-lg font-semibold">{formatPackage(variant.amount, variant.count, product.unit)}</h2>
				<div className="flex items-center gap-3">
					<Link href={`/products/${product.id}/variants/${variant.id}/edit`} className="text-xs text-zinc-600 hover:underline dark:text-zinc-300">
						荷姿を編集
					</Link>
					{deletable && (
						<ConfirmForm action={deleteVariant} message="この荷姿と価格記録を削除しますか？">
							<input type="hidden" name="id" value={variant.id} />
							<input type="hidden" name="productId" value={product.id} />
							<button type="submit" className="text-xs text-red-600 hover:underline">
								荷姿を削除
							</button>
						</ConfirmForm>
					)}
				</div>
			</div>

			{best ? (
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950">
					<p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">最安値</p>
					<p className="flex flex-wrap items-baseline gap-x-3">
						<span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
							{formatYen(perUnit(best))}
							<span className="ml-1 text-sm font-normal">/ {unitBaseLabel(product.unit)}</span>
						</span>
						<span className="text-xl font-semibold text-emerald-800 dark:text-emerald-200">
							{formatYen(best.price, 0)}
							<span className="ml-1 text-sm font-normal">/ {formatAmount(total, best.quantity, product.unit)}</span>
						</span>
					</p>
					<p className="text-sm text-emerald-800 dark:text-emerald-200">
						<StoreLabel store={best.store} url={best.url} /> ・ {best.recordedAt}
					</p>
				</div>
			) : (
				<p className="text-sm text-zinc-400">価格はまだ記録されていません</p>
			)}

			<details open={formOpen} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
				<summary className="cursor-pointer text-sm font-semibold">価格を記録</summary>
				<div className="pt-3">
					<RecordForm action={createRecord} productId={product.id} variantId={variant.id} unit={product.unit} amount={total} stores={stores} />
				</div>
			</details>

			{records.length > 0 && (
				<div className="space-y-2">
					<h3 className="text-sm font-semibold">価格記録（単価が安い順）</h3>
					<div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
						<table className="w-full text-sm">
							<thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900">
								<tr>
									<th className="px-3 py-2">単価 / {unitBaseLabel(product.unit)}</th>
									<th className="px-3 py-2">店舗</th>
									<th className="px-3 py-2">価格</th>
									<th className="px-3 py-2">容量</th>
									<th className="px-3 py-2">日付</th>
									<th className="px-3 py-2">写真</th>
									<th className="px-3 py-2">メモ</th>
									<th className="px-3 py-2"></th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
								{records.map((r, i) => (
									<tr key={r.id} className={i === 0 ? "bg-emerald-50/60 dark:bg-emerald-950/40" : undefined}>
										<td className="px-3 py-2 font-semibold">{formatYen(perUnit(r))}</td>
										<td className="px-3 py-2">
											<StoreLabel store={r.store} url={r.url} />
										</td>
										<td className="px-3 py-2">{formatYen(r.price, 0)}</td>
										<td className="px-3 py-2">{formatAmount(total, r.quantity, product.unit)}</td>
										<td className="px-3 py-2 whitespace-nowrap">{r.recordedAt}</td>
										<td className="px-3 py-2">
											{r.imageKey && (
												<a href={imageUrl(r.imageKey)} target="_blank" rel="noopener noreferrer" title="拡大して表示">
													<img
														src={imageUrl(r.imageKey)}
														alt=""
														loading="lazy"
														className="h-10 w-10 rounded border border-zinc-200 bg-zinc-100 object-contain dark:border-zinc-700 dark:bg-zinc-800"
													/>
												</a>
											)}
										</td>
										<td className="px-3 py-2 text-zinc-500">{r.memo}</td>
										<td className="px-3 py-2 text-right">
											<div className="flex items-center justify-end gap-2">
												<Link href={`/products/${product.id}/records/${r.id}/edit`} className="text-xs text-zinc-600 hover:underline dark:text-zinc-300">
													編集
												</Link>
												<ConfirmForm action={deleteRecord} message="この価格記録を削除しますか？">
													<input type="hidden" name="id" value={r.id} />
													<input type="hidden" name="productId" value={product.id} />
													<button type="submit" className="text-xs text-red-600 hover:underline">
														削除
													</button>
												</ConfirmForm>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</section>
	);
}

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
	await requireUser();
	const id = parseId((await params).id);
	if (id === null) notFound();

	const db = await getDb();
	const product = await getProduct(db, id);
	if (!product) notFound();
	const [variants, stores, mergeTargets] = await Promise.all([listVariants(db, id), listStores(db), listMergeTargets(db, product)]);
	const recordsByVariant = await Promise.all(variants.map((v) => listRecords(db, v.id)));

	return (
		<div className="space-y-8">
			<section className="flex flex-col gap-4 sm:flex-row">
				<div className="h-48 w-48 flex-none overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
					{product.imageKey ? (
						<img src={imageUrl(product.imageKey)} alt={product.name} className="h-full w-full object-contain" />
					) : (
						<div className="flex h-full w-full items-center justify-center text-5xl text-zinc-400">📦</div>
					)}
				</div>
				<div className="flex-1 space-y-2">
					<p className="text-sm text-zinc-500">{product.categoryName ?? "未分類"}</p>
					<h1 className="text-2xl font-bold">{product.name}</h1>
					{product.maker && <p className="text-sm text-zinc-600 dark:text-zinc-400">{product.maker}</p>}
					{product.memo && <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">{product.memo}</p>}
					<div className="flex flex-wrap gap-2 pt-2">
						<LinkButton href={`/products/${product.id}/edit`}>編集</LinkButton>
						<ConfirmForm action={deleteProduct} message={`「${product.name}」と荷姿・価格記録をすべて削除しますか？`}>
							<input type="hidden" name="id" value={product.id} />
							<DangerButton>商品を削除</DangerButton>
						</ConfirmForm>
					</div>
				</div>
			</section>

			{/* 最安値は荷姿ごとに判定する。大容量のまとめ買いが常に勝って比較にならないのを避けるため */}
			{variants.map((v, i) => (
				<VariantSection
					key={v.id}
					product={product}
					variant={v}
					records={recordsByVariant[i] ?? []}
					stores={stores}
					deletable={variants.length > 1}
					formOpen={variants.length === 1}
				/>
			))}

			<section className="space-y-3 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
				<h2 className="font-semibold">荷姿を追加</h2>
				<p className="text-xs text-zinc-500">同じ商品で容量や入数が違うものは、荷姿として追加すると最安値を別々に比べられます</p>
				<VariantForm action={createVariant} productId={product.id} unit={product.unit} />
			</section>

			{mergeTargets.length > 0 && (
				<section className="space-y-3 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
					<h2 className="font-semibold">別の商品へ統合</h2>
					<p className="text-xs text-zinc-500">
						同じ商品を別々に登録してしまったときに使います。この商品の荷姿と価格記録を統合先へ移し、この商品は削除します。
						名前や画像は統合先のものが残ります。選べるのは単位が同じ（{product.unit}）商品だけです
					</p>
					<ConfirmForm action={mergeProduct} message={`「${product.name}」を統合先へまとめて削除しますか？`} className="flex flex-col gap-2 sm:flex-row">
						<input type="hidden" name="id" value={product.id} />
						<select name="targetId" required defaultValue="" aria-label="統合先の商品" className={inputClass}>
							<option value="" disabled>
								統合先を選ぶ
							</option>
							{mergeTargets.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
									{t.maker ? `（${t.maker}）` : ""}
								</option>
							))}
						</select>
						<DangerButton>統合する</DangerButton>
					</ConfirmForm>
				</section>
			)}
		</div>
	);
}
