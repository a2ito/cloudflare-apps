import Link from "next/link";
import { notFound } from "next/navigation";
import { moveField } from "@/app/actions/fields";
import { deleteProduct, setProductHidden } from "@/app/actions/products";
import { ColumnResizer } from "@/components/column-resizer";
import { ConfirmForm, LinkButton, UsedBadge, inputClass } from "@/components/ui";
import { getDb } from "@/db";
import { getCategory, listCompareItems, listFields } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import {
	compare,
	costLabel,
	costPer,
	formatSpec,
	formatYen,
	isCostField,
	parseCompareQuery,
	parseIncludeUsed,
	type CompareItem,
	type CompareQuery,
	type FieldDef,
	type HighlightKey,
	type SortDir,
	type SortKey,
} from "@/lib/compare";
import { imageUrl } from "@/lib/images";
import { parseId } from "@/lib/params";
import { isSafeExternalUrl } from "@/lib/url";

type Params = Record<string, string | string[] | undefined>;

/** 今の検索条件を残したまま一部だけ差し替えたリンク */
function hrefWith(base: string, params: Params, overrides: Record<string, string | undefined>): string {
	const sp = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v !== "") sp.set(k, v);
	for (const [k, v] of Object.entries(overrides)) {
		if (v === undefined) sp.delete(k);
		else sp.set(k, v);
	}
	const s = sp.toString();
	return s ? `${base}?${s}` : base;
}

/** 列を初めて押したときの向き。良い順に並ぶようにする */
function defaultDir(key: SortKey, fields: readonly FieldDef[]): SortDir {
	if (!key.startsWith("f")) return "asc";
	const field = fields.find((f) => `f${f.id}` === key);
	return field?.better === "higher" ? "desc" : "asc";
}

function SortHeader({ label, sortKey, query, fields, base, params }: { label: string; sortKey: SortKey; query: CompareQuery; fields: readonly FieldDef[]; base: string; params: Params }) {
	const active = query.sort === sortKey;
	const dir: SortDir = active ? (query.dir === "asc" ? "desc" : "asc") : defaultDir(sortKey, fields);
	return (
		<Link href={hrefWith(base, params, { sort: sortKey, dir })} className="inline-flex items-center gap-1 hover:underline" scroll={false}>
			{label}
			{active && <span aria-label={query.dir === "asc" ? "昇順" : "降順"}>{query.dir === "asc" ? "▲" : "▼"}</span>}
		</Link>
	);
}

/**
 * 列を左右に動かすボタン。並び順はカテゴリの設定画面と同じ position に保存するので、
 * 次に開いたときも、ほかの端末でも同じ順に並ぶ
 */
function MoveButtons({ field, categoryId, isFirst, isLast }: { field: FieldDef; categoryId: number; isFirst: boolean; isLast: boolean }) {
	return (
		<span className="mt-1 flex justify-end gap-1">
			{(["up", "down"] as const).map((direction) => (
				<form key={direction} action={moveField}>
					<input type="hidden" name="id" value={field.id} />
					<input type="hidden" name="categoryId" value={categoryId} />
					<input type="hidden" name="direction" value={direction} />
					<button
						type="submit"
						disabled={direction === "up" ? isFirst : isLast}
						className="rounded px-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 disabled:invisible dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
						aria-label={`${field.name}を${direction === "up" ? "左" : "右"}へ移動`}
						title={direction === "up" ? "左へ移動" : "右へ移動"}
					>
						{direction === "up" ? "←" : "→"}
					</button>
				</form>
			))}
		</span>
	);
}

const rowButton = "rounded px-1.5 py-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800";

/** 行ごとの操作。非表示は消さずに候補から外すだけ、削除は価格の記録や画像まで消す */
function RowActions({ item }: { item: CompareItem }) {
	return (
		<span className="flex justify-end gap-1">
			<form action={setProductHidden}>
				<input type="hidden" name="id" value={item.id} />
				<input type="hidden" name="hidden" value={item.hidden ? "0" : "1"} />
				<button type="submit" className={`${rowButton} text-zinc-500`}>
					{item.hidden ? "表示に戻す" : "非表示"}
				</button>
			</form>
			<ConfirmForm action={deleteProduct} message={`「${item.name}」を削除しますか？\nスペックと価格の記録も消えます。候補から外すだけなら「非表示」を使ってください。`}>
				<input type="hidden" name="id" value={item.id} />
				<button type="submit" className={`${rowButton} text-red-600 dark:text-red-400`}>
					削除
				</button>
			</ConfirmForm>
		</span>
	);
}

function cellClass(isBest: boolean): string {
	return `whitespace-nowrap px-3 py-2 text-right tabular-nums ${isBest ? "bg-indigo-50 font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200" : ""}`;
}

function FilterForm({ fields, query, params, base }: { fields: readonly FieldDef[]; query: CompareQuery; params: Params; base: string }) {
	const costFields = fields.filter(isCostField);
	const value = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
	const active =
		query.ranges.length + query.required.length + query.contains.length + (query.maxPrice !== undefined ? 1 : 0) + (query.includeUsed ? 1 : 0) + (query.showHidden ? 1 : 0);

	return (
		<details className="group rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950" open={active > 0}>
			<summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
				<span className="inline-block transition-transform group-open:rotate-90">▶</span>
				絞り込み・コスパ
				{active > 0 && <span className="ml-1 rounded-full bg-indigo-600 px-2 text-xs text-white">{active}</span>}
			</summary>
			{/* 条件は URL に載せる。共有やブラウザの戻るで同じ表に戻れるように */}
			<form className="mt-3 space-y-3">
				<input type="hidden" name="sort" value={query.sort} />
				<input type="hidden" name="dir" value={query.dir} />
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					<label className="block space-y-1 text-sm">
						<span className="font-medium text-zinc-700 dark:text-zinc-300">価格の上限（円）</span>
						<input name="maxPrice" type="number" inputMode="numeric" min={0} defaultValue={value("maxPrice")} className={inputClass} />
					</label>
					<label className="flex items-center gap-2 self-end py-2 text-sm">
						<input type="checkbox" name="used" value="1" defaultChecked={query.includeUsed} />
						新品があっても中古の価格を最安値に含める
					</label>
					<label className="flex items-center gap-2 self-end py-2 text-sm">
						<input type="checkbox" name="hidden" value="1" defaultChecked={query.showHidden} />
						非表示の商品も表示
					</label>
					{costFields.length > 0 && (
						<label className="block space-y-1 text-sm">
							<span className="font-medium text-zinc-700 dark:text-zinc-300">コスパの基準</span>
							<select name="cost" defaultValue={query.costFieldId ?? ""} className={inputClass}>
								<option value="">出さない</option>
								{costFields.map((f) => (
									<option key={f.id} value={f.id}>
										{costLabel(f)}の価格
									</option>
								))}
							</select>
						</label>
					)}
					{fields.map((f) => {
						if (f.kind === "number") {
							return (
								<fieldset key={f.id} className="space-y-1 text-sm">
									<legend className="font-medium text-zinc-700 dark:text-zinc-300">
										{f.name}
										{f.unit && `（${f.unit}）`}
									</legend>
									<div className="flex items-center gap-2">
										<input name={`min_${f.id}`} type="number" step="any" defaultValue={value(`min_${f.id}`)} placeholder="下限" aria-label={`${f.name}の下限`} className={inputClass} />
										<span className="text-zinc-400">〜</span>
										<input name={`max_${f.id}`} type="number" step="any" defaultValue={value(`max_${f.id}`)} placeholder="上限" aria-label={`${f.name}の上限`} className={inputClass} />
									</div>
								</fieldset>
							);
						}
						if (f.kind === "bool") {
							return (
								<label key={f.id} className="flex items-center gap-2 self-end py-2 text-sm">
									<input type="checkbox" name={`has_${f.id}`} value="1" defaultChecked={value(`has_${f.id}`) === "1"} />
									{f.name}あり
								</label>
							);
						}
						return (
							<label key={f.id} className="block space-y-1 text-sm">
								<span className="font-medium text-zinc-700 dark:text-zinc-300">{f.name}（を含む）</span>
								<input name={`q_${f.id}`} defaultValue={value(`q_${f.id}`)} className={inputClass} />
							</label>
						);
					})}
				</div>
				<div className="flex items-center gap-3">
					<button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
						適用
					</button>
					<Link href={base} className="text-sm text-zinc-500 hover:underline">
						条件をクリア
					</Link>
				</div>
			</form>
		</details>
	);
}

export default async function ComparePage({ params, searchParams }: PageProps<"/categories/[id]">) {
	await requireUser();
	const id = parseId((await params).id);
	if (id === null) notFound();

	const db = await getDb();
	const sp = await searchParams;
	const [category, fields, items] = await Promise.all([getCategory(db, id), listFields(db, id), listCompareItems(db, id, parseIncludeUsed(sp))]);
	if (!category) notFound();

	const query = parseCompareQuery(sp, fields, category.defaultCostFieldId);
	const { rows, best } = compare(items, fields, query);
	const costField = fields.find((f) => f.id === query.costFieldId);
	const base = `/categories/${id}`;
	const isBest = (key: HighlightKey, v: number | null | undefined) => v !== null && v !== undefined && best.get(key) === v;

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<Link href="/" className="text-sm text-zinc-500 hover:underline">
						← カテゴリ一覧
					</Link>
					<h1 className="text-xl font-bold">{category.name}</h1>
				</div>
				<div className="flex gap-2">
					<LinkButton href={`/categories/${id}/settings`}>スペック項目</LinkButton>
					<LinkButton href={`/products/new?category=${id}`} variant="primary">
						商品を追加
					</LinkButton>
				</div>
			</div>

			{items.length === 0 ? (
				<div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
					<p>商品がまだありません</p>
					<Link href={`/products/new?category=${id}`} className="mt-2 inline-block font-medium text-indigo-700 hover:underline dark:text-indigo-400">
						最初の商品を登録する
					</Link>
				</div>
			) : (
				<>
					<FilterForm fields={fields} query={query} params={sp} base={base} />
					<p className="text-sm text-zinc-500">
						{items.length} 件中 {rows.length} 件を表示。
						<span className="ml-1">一番良い値に色を付けています</span>
					</p>
					{rows.length === 0 ? (
						<p className="py-10 text-center text-sm text-zinc-500">条件に合う商品はありません</p>
					) : (
						<div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
							<table className="min-w-full text-sm">
								<thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
									<tr>
										{/* 横に長くても何の行か分かるよう、商品名の列は左に固定する */}
										<th className="sticky left-0 z-10 bg-zinc-50 px-3 py-2 text-left dark:bg-zinc-900">
											<SortHeader label="商品" sortKey="name" query={query} fields={fields} base={base} params={sp} />
										</th>
										<th data-col="price" className="relative px-3 py-2 text-right whitespace-nowrap">
											<SortHeader label="最安値" sortKey="price" query={query} fields={fields} base={base} params={sp} />
											<ColumnResizer categoryId={id} column="price" label="最安値" />
										</th>
										{costField && (
											<th data-col="cost" className="relative px-3 py-2 text-right whitespace-nowrap">
												<SortHeader label={costLabel(costField)} sortKey="cost" query={query} fields={fields} base={base} params={sp} />
												<ColumnResizer categoryId={id} column="cost" label={costLabel(costField)} />
											</th>
										)}
										{fields.map((f, i) => (
											<th key={f.id} data-col={`f${f.id}`} className="relative px-3 py-2 text-right whitespace-nowrap">
												<SortHeader label={f.name} sortKey={`f${f.id}`} query={query} fields={fields} base={base} params={sp} />
												<MoveButtons field={f} categoryId={id} isFirst={i === 0} isLast={i === fields.length - 1} />
												<ColumnResizer categoryId={id} column={`f${f.id}`} label={f.name} />
											</th>
										))}
										<th className="px-3 py-2">
												<span className="sr-only">操作</span>
											</th>
										</tr>
								</thead>
								<tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
									{rows.map((item) => {
										const cost = costField ? costPer(item.best?.price, item.specs[costField.id]?.num) : null;
										return (
											<tr key={item.id} className={item.hidden ? "opacity-50" : undefined}>
												<td className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-zinc-950">
													<Link href={`/products/${item.id}`} className="flex max-w-56 items-center gap-2 hover:underline">
														<span className="h-10 w-10 flex-none overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
															{item.imageKey && <img src={imageUrl(item.imageKey)} alt="" className="h-full w-full object-contain" loading="lazy" />}
														</span>
														<span className="min-w-0">
															<span className="block truncate font-medium">{item.name}</span>
															{item.maker && <span className="block truncate text-xs text-zinc-500">{item.maker}</span>}
														</span>
													</Link>
												</td>
												<td data-col="price" className={cellClass(isBest("price", item.best?.price))}>
													{item.best ? (
														<>
															{item.best.used && <UsedBadge />}
															{formatYen(item.best.price)}
															{/* 比較表から買いに行けるよう、最安値を記録したお店のページへ飛べるようにする */}
															{isSafeExternalUrl(item.best.url) ? (
																<a href={item.best.url ?? undefined} target="_blank" rel="noopener noreferrer" className="block text-xs font-normal text-indigo-700 hover:underline dark:text-indigo-400">
																	{item.best.store} ↗
																</a>
															) : (
																<span className="block text-xs font-normal text-zinc-500">{item.best.store}</span>
															)}
														</>
													) : (
														<span className="text-zinc-400">—</span>
													)}
												</td>
												{costField && (
													<td data-col="cost" className={cellClass(isBest("cost", cost))}>{cost === null ? <span className="text-zinc-400">—</span> : formatYen(cost, cost < 100 ? 2 : 0)}</td>
												)}
												{fields.map((f) => {
													const text = formatSpec(f, item.specs[f.id]);
													return (
														<td key={f.id} data-col={`f${f.id}`} className={cellClass(isBest(f.id, item.specs[f.id]?.num))}>
															{text ?? <span className="text-zinc-400">—</span>}
														</td>
													);
												})}
												<td className="px-3 py-2 whitespace-nowrap">
													<RowActions item={item} />
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
					{costField && (
						<p className="text-xs text-zinc-500">
							{costLabel(costField)}の価格 = 最安値 ÷ {costField.name}。安いほど同じ{costField.name}を安く買えています
						</p>
					)}
				</>
			)}
		</div>
	);
}
