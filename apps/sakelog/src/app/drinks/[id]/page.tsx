import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDrinkAction } from "@/app/actions/drinks";
import { PhotoGallery } from "@/components/photo-gallery";
import { Rating, RatingAxes } from "@/components/rating";
import { ConfirmForm, DangerButton, LinkButton } from "@/components/ui";
import { getDb } from "@/db";
import { getDrink } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { categoryDef, SPECIFIC_FIELDS, termNote } from "@/lib/categories";
import { formatDate, formatTimestamp } from "@/lib/datetime";
import { DEFAULT_CURRENCY, formatMoney } from "@/lib/money";
import { photoFileName } from "@/lib/photo-name";
import { photoUrl } from "@/lib/photos";
import { toRatings } from "@/lib/ratings";
import { shopUrlHost } from "@/lib/shop-url";

export default async function DrinkPage({ params }: PageProps<"/drinks/[id]">) {
  await requireUser();
  const { id } = await params;
  const drinkId = Number(id);
  if (!Number.isInteger(drinkId)) notFound();

  const db = await getDb();
  const drink = await getDrink(db, drinkId);
  if (!drink) notFound();

  const def = categoryDef(drink.category);
  const authorName = drink.author.name ?? drink.author.email;
  // photoUrl は Cloudflare の env に触れるモジュールにあるので、URL はここで作って渡す
  const galleryPhotos = drink.photos.map((photo, index) => ({
    id: photo.id,
    src: photoUrl(photo.key),
    downloadName: photoFileName(drink.name, index, photo.contentType),
  }));
  const origin = [drink.country, drink.region].filter(Boolean).join(" / ");
  // 種類ごとの項目は、値が入っているものだけ出す
  const specifics = def.fields
    .map((field) => ({ field, value: drink[field] }))
    .filter((f) => f.value !== null && f.value !== undefined);

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← 一覧
      </Link>

      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-500">
              <Link
                href={`/?category=${drink.category}`}
                className="hover:underline"
              >
                {def.emoji} {def.label}
              </Link>
              {drink.style && (
                <span
                  title={termNote(drink.category, drink.style) ?? undefined}
                >
                  {" "}
                  ・ {drink.style}
                </span>
              )}
              {drink.year && ` ・ ${drink.year}`}{" "}
              <Link
                href={`/guide#${drink.category}`}
                className="hover:underline"
              >
                （ガイド）
              </Link>
            </p>
            <h1 className="text-2xl font-bold">{drink.name}</h1>
            {drink.maker && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {drink.maker}
              </p>
            )}
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-zinc-500">
              <span>
                {drink.drunkAt
                  ? `${formatDate(drink.drunkAt)} に飲んだ`
                  : "まだ開けていない"}
              </span>
              {origin && <span>・{origin}</span>}
              {drink.abv != null && <span>・{drink.abv}%</span>}
              <Rating value={drink.ratingOverall} />
            </p>
          </div>
          <LinkButton href={`/drinks/${drink.id}/edit`}>編集</LinkButton>
        </div>

        {drink.ingredients.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {drink.ingredients.map((ingredient) => (
              <li key={ingredient.id}>
                {/* 材料から一覧の絞り込みへ飛べると、似た好みのものを辿れる。
								    知っている材料なら、その特性を title で添える（詳しくはガイドへ） */}
                <Link
                  href={`/?category=${drink.category}&ingredient=${encodeURIComponent(ingredient.name)}`}
                  title={termNote(drink.category, ingredient.name) ?? undefined}
                  className="inline-flex rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:border-sky-400 dark:border-zinc-700 dark:text-zinc-300"
                >
                  {ingredient.name}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {specifics.length > 0 && (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
            {specifics.map(({ field, value }) => (
              <div key={field} className="flex items-baseline gap-2">
                <dt className="text-zinc-500">
                  {SPECIFIC_FIELDS[field].label}
                </dt>
                <dd className="font-medium">
                  {/* 日本酒度は + を付けないと辛口か甘口か読み取れない */}
                  {field === "sakeMeterValue" &&
                  typeof value === "number" &&
                  value > 0
                    ? `+${value}`
                    : value}
                  {SPECIFIC_FIELDS[field].unit}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {drink.priceMinor != null && (
          <p className="text-xl font-bold">
            {formatMoney(
              drink.priceMinor,
              drink.priceCurrency ?? DEFAULT_CURRENCY,
            )}
          </p>
        )}

        {(drink.shop || drink.shopUrl) && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span>🛒 {drink.shop ?? "購入場所"}</span>
            {/* 保存時に https の URL だけを通しているが、外部リンクなので参照元は渡さない */}
            {drink.shopUrl && (
              <a
                href={drink.shopUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 hover:underline dark:text-sky-400"
              >
                {shopUrlHost(drink.shopUrl)}
              </a>
            )}
          </p>
        )}

        <RatingAxes ratings={toRatings(drink)} />

        <p className="text-xs text-zinc-500">
          {authorName} が {formatTimestamp(drink.createdAt)} に記録
          {drink.updatedAt !== drink.createdAt &&
            `（最終更新 ${formatTimestamp(drink.updatedAt)}）`}
        </p>

        {drink.note && (
          <p className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
            {drink.note}
          </p>
        )}
      </div>

      {drink.photos.length > 0 && <PhotoGallery photos={galleryPhotos} />}

      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <ConfirmForm
          action={deleteDrinkAction}
          message={`「${drink.name}」を削除します。よろしいですか？`}
        >
          <input type="hidden" name="id" value={drink.id} />
          <DangerButton>この記録を削除する</DangerButton>
        </ConfirmForm>
      </div>
    </div>
  );
}
