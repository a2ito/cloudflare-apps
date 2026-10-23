import Link from "next/link";
import { LinkPending } from "@/components/link-pending";
import { Rating } from "@/components/rating";
import { LinkButton, inputClass } from "@/components/ui";
import { getDb } from "@/db";
import {
  countByCategory,
  listDrinks,
  listIngredientNames,
  type DrinkFilter,
  type DrinkSort,
} from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { CATEGORY_DEFS, categoryDef, categoryEmoji } from "@/lib/categories";
import { formatDate } from "@/lib/datetime";
import { DEFAULT_CURRENCY, formatMoney } from "@/lib/money";
import { photoUrl } from "@/lib/photos";

const SORT_OPTIONS: readonly { value: DrinkSort; label: string }[] = [
  { value: "recent", label: "飲んだ日が新しい順" },
  { value: "rating", label: "総合評価が高い順" },
  { value: "price", label: "価格が高い順" },
];

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed === "" ? undefined : trimmed;
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  await requireUser();
  const params = await searchParams;

  const q = first(params.q);
  const category = first(params.category);
  const ingredient = first(params.ingredient);
  const minRating = Number(first(params.minRating) ?? 0);
  const sortParam = first(params.sort);
  const sort: DrinkSort = SORT_OPTIONS.some((s) => s.value === sortParam)
    ? (sortParam as DrinkSort)
    : "recent";

  const filter: DrinkFilter = {
    q,
    category,
    ingredient,
    minRating:
      Number.isInteger(minRating) && minRating > 0 ? minRating : undefined,
  };
  const hasFilter = Boolean(q || category || ingredient || filter.minRating);

  const db = await getDb();
  const [drinks, ingredientNames, counts] = await Promise.all([
    listDrinks(db, filter, sort),
    // 種類を選んでいるときは、その種類で使われている材料だけを候補に出す
    listIngredientNames(db, category),
    countByCategory(db),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">記録（{drinks.length}）</h1>
        <LinkButton href="/drinks/new" variant="primary">
          記録する
        </LinkButton>
      </div>

      {/* 種類は使う頻度が高いので、絞り込みフォームとは別にタブとして出す */}
      <nav className="flex flex-wrap gap-2">
        <CategoryTab href="/" label="すべて" active={!category} />
        {CATEGORY_DEFS.filter(
          (c) => (counts.get(c.key) ?? 0) > 0 || c.key === category,
        ).map((c) => (
          <CategoryTab
            key={c.key}
            href={`/?category=${c.key}`}
            label={`${c.emoji} ${c.label} ${counts.get(c.key) ?? 0}`}
            active={category === c.key}
          />
        ))}
      </nav>

      {/* 絞り込みは GET で送る。条件が URL に残るので、共有もブックマークもできる */}
      <form className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-950">
        {/* タブで選んだ種類を絞り込みでも保つ */}
        {category && <input type="hidden" name="category" value={category} />}
        <label className="sm:col-span-2">
          <span className="sr-only">検索</span>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            className={inputClass}
            placeholder="銘柄・造り手・産地・分類・材料・購入場所で検索"
          />
        </label>
        <label>
          <span className="sr-only">
            {category ? categoryDef(category).ingredientLabel : "材料"}
          </span>
          <select
            name="ingredient"
            defaultValue={ingredient ?? ""}
            className={inputClass}
          >
            <option value="">
              すべての
              {category ? categoryDef(category).ingredientLabel : "材料"}
            </option>
            {ingredientNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">総合評価</span>
          <select
            name="minRating"
            defaultValue={String(filter.minRating ?? 0)}
            className={inputClass}
          >
            <option value="0">評価で絞らない</option>
            <option value="5">★★★★★ のみ</option>
            <option value="4">★★★★ 以上</option>
            <option value="3">★★★ 以上</option>
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="sr-only">並び順</span>
          <select name="sort" defaultValue={sort} className={inputClass}>
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            絞り込む
          </button>
          {hasFilter && (
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              条件を消す
            </Link>
          )}
        </div>
      </form>

      {drinks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {hasFilter
            ? "条件に合う記録がありません"
            : "まだ記録がありません。最初の 1 本を記録しましょう"}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {drinks.map((drink) => {
            // 並び順の先頭がサムネイル（詳細画面から差し替えられる）
            const cover = drink.photos[0];
            return (
              <li key={drink.id}>
                <Link
                  href={`/drinks/${drink.id}`}
                  className="flex h-full gap-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition hover:border-sky-400 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  {cover ? (
                    <img
                      src={photoUrl(cover.key)}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-md border border-zinc-200 bg-zinc-100 object-cover dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-zinc-200 text-2xl dark:border-zinc-700"
                    >
                      {categoryEmoji(drink.category)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-zinc-500">
                      {categoryDef(drink.category).label}
                      {drink.style && ` ・ ${drink.style}`}
                      {drink.year && ` ・ ${drink.year}`}
                    </p>
                    <h2 className="flex items-center gap-2 font-semibold">
                      <span className="truncate">{drink.name}</span>
                      {/* 押したカードが反応するように、遷移待ちの間だけぐるぐるを出す */}
                      <LinkPending />
                    </h2>
                    {drink.maker && (
                      <p className="truncate text-sm text-zinc-500">
                        {drink.maker}
                      </p>
                    )}
                    {drink.ingredients.length > 0 && (
                      <p className="truncate text-xs text-zinc-500">
                        {drink.ingredients.map((i) => i.name).join(" / ")}
                      </p>
                    )}
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
                      <Rating value={drink.ratingOverall} />
                      {drink.priceMinor != null && (
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {formatMoney(
                            drink.priceMinor,
                            drink.priceCurrency ?? DEFAULT_CURRENCY,
                          )}
                        </span>
                      )}
                      <span className="text-xs text-zinc-500">
                        {drink.drunkAt ? formatDate(drink.drunkAt) : "未開栓"}
                      </span>
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CategoryTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm ${
        active
          ? "border-sky-500 bg-sky-50 font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300"
          : "border-zinc-300 text-zinc-700 hover:border-sky-400 dark:border-zinc-700 dark:text-zinc-300"
      }`}
    >
      {label}
    </Link>
  );
}
