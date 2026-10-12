import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProduct } from "@/app/actions/products";
import { createRecord, deleteRecord } from "@/app/actions/records";
import { RecordForm } from "@/components/record-form";
import { ConfirmForm, DangerButton, LinkButton } from "@/components/ui";
import { getDb } from "@/db";
import { getProduct, listCompareItems, listFields, listRecords, listStores } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { formatSpec, formatYen, rankIn } from "@/lib/compare";
import { today } from "@/lib/date";
import { imageUrl } from "@/lib/images";
import { parseId } from "@/lib/params";
import { linkHostname } from "@/lib/url";

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
	await requireUser();
	const id = parseId((await params).id);
	if (id === null) notFound();

	const db = await getDb();
	const product = await getProduct(db, id);
	if (!product) notFound();
	const [fields, items, records, stores] = await Promise.all([
		listFields(db, product.categoryId),
		listCompareItems(db, product.categoryId),
		listRecords(db, id),
		listStores(db),
	]);
	const self = items.find((i) => i.id === id);
	const bestId = self?.best?.id;

	return (
		<div className="mx-auto max-w-3xl space-y-8">
			<div className="flex flex-col gap-4 sm:flex-row">
				<div className="h-48 w-48 flex-none overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800">
					{product.imageKey ? (
						<img src={imageUrl(product.imageKey)} alt={product.name} className="h-full w-full object-contain" />
					) : (
						<div className="flex h-full w-full items-center justify-center text-4xl text-zinc-400">📦</div>
					)}
				</div>
				<div className="min-w-0 flex-1 space-y-2">
					<Link href={`/categories/${product.categoryId}`} className="text-sm text-zinc-500 hover:underline">
						← {product.categoryName}の比較表
					</Link>
					<h1 className="text-2xl font-bold">{product.name}</h1>
					{product.maker && <p className="text-sm text-zinc-500">{product.maker}</p>}
					{self?.best && (
						<p className="text-lg">
							最安値 <span className="font-bold text-indigo-700 dark:text-indigo-400">{formatYen(self.best.price)}</span>
							<span className="ml-2 text-sm text-zinc-500">
								{self.best.store} ・ {self.best.recordedAt}
							</span>
						</p>
					)}
					{product.memo && <p className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{product.memo}</p>}
					<div className="flex flex-wrap gap-2 pt-1">
						<LinkButton href={`/products/${id}/edit`}>編集</LinkButton>
						<ConfirmForm action={deleteProduct} message={`「${product.name}」を削除しますか？\nスペックと価格の記録も消えます。`}>
							<input type="hidden" name="id" value={id} />
							<DangerButton>削除</DangerButton>
						</ConfirmForm>
					</div>
				</div>
			</div>

			<section className="space-y-2">
				<h2 className="font-semibold">スペック</h2>
				{fields.length === 0 ? (
					<p className="text-sm text-zinc-500">
						スペック項目がありません。
						<Link href={`/categories/${product.categoryId}/settings`} className="text-indigo-700 hover:underline dark:text-indigo-400">
							カテゴリの設定
						</Link>
						で追加できます
					</p>
				) : (
					<dl className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
						{fields.map((f) => {
							const text = formatSpec(f, self?.specs[f.id]);
							const rank = rankIn(items, f, id);
							return (
								<div key={f.id} className="flex items-baseline justify-between gap-4 px-4 py-2 text-sm">
									<dt className="text-zinc-600 dark:text-zinc-400">{f.name}</dt>
									<dd className="text-right">
										{text ?? <span className="text-zinc-400">未入力</span>}
										{/* カテゴリの中での位置が分かると、比較表を開かなくても強み・弱みが見える */}
										{rank && (
											<span className={`ml-2 text-xs ${rank.rank === 1 ? "font-semibold text-indigo-700 dark:text-indigo-400" : "text-zinc-500"}`}>
												{rank.total} 件中 {rank.rank} 位
											</span>
										)}
									</dd>
								</div>
							);
						})}
					</dl>
				)}
			</section>

			<section className="space-y-3">
				<h2 className="font-semibold">価格の記録</h2>
				{records.length === 0 ? (
					<p className="text-sm text-zinc-500">まだ記録がありません</p>
				) : (
					<ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
						{records.map((r) => {
							const host = linkHostname(r.url);
							return (
								<li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
									<div className="min-w-0">
										<p>
											<span className={`font-semibold ${r.id === bestId ? "text-indigo-700 dark:text-indigo-400" : ""}`}>{formatYen(r.price)}</span>
											<span className="ml-2">{r.store}</span>
											{r.id === bestId && <span className="ml-2 rounded bg-indigo-600 px-1.5 text-xs text-white">最安</span>}
										</p>
										<p className="text-xs text-zinc-500">
											{r.recordedAt}
											{host && r.url && (
												<a href={r.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-700 hover:underline dark:text-indigo-400">
													{host}
												</a>
											)}
											{r.memo && <span className="ml-2">{r.memo}</span>}
										</p>
									</div>
									<div className="flex items-center gap-2">
										<Link href={`/products/${id}/records/${r.id}/edit`} className="text-zinc-500 hover:underline">
											編集
										</Link>
										<ConfirmForm action={deleteRecord} message={`${r.store} の ${formatYen(r.price)} を削除しますか？`}>
											<input type="hidden" name="id" value={r.id} />
											<input type="hidden" name="productId" value={id} />
											<DangerButton>削除</DangerButton>
										</ConfirmForm>
									</div>
								</li>
							);
						})}
					</ul>
				)}
				<div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
					<h3 className="mb-3 text-sm font-semibold">価格を記録する</h3>
					<RecordForm action={createRecord} productId={id} stores={stores} today={today()} />
				</div>
			</section>
		</div>
	);
}
