import { setProductFavorite } from "@/app/actions/products";

/** 比較表の行と商品ページで使う ☆ ボタン。押すとお気に入りを付け外しする */
export function FavoriteButton({
  id,
  favorite,
}: {
  id: number;
  favorite: boolean;
}) {
  return (
    <form action={setProductFavorite} className="flex-none">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="favorite" value={favorite ? "0" : "1"} />
      <button
        type="submit"
        aria-label={favorite ? "お気に入りから外す" : "お気に入りに追加"}
        aria-pressed={favorite}
        title={favorite ? "お気に入りから外す" : "お気に入りに追加"}
        className={`rounded px-1 text-lg leading-none hover:bg-zinc-100 dark:hover:bg-zinc-800 ${favorite ? "text-amber-500" : "text-zinc-300 dark:text-zinc-600"}`}
      >
        {favorite ? "★" : "☆"}
      </button>
    </form>
  );
}
