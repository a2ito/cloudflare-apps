import Link from "next/link";
import { LinkButton } from "@/components/ui";

/**
 * 見つからなかったときの画面。
 *
 * 素の Next.js の 404 と見分けが付くようにしてある。原因不明の 404 が
 * 報告されたとき、この画面が出たかどうかで「アプリが返した 404」か
 * 「それ以外（古いページ・通信の失敗など）」かを切り分けられる。
 */
export default function NotFound() {
  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h1 className="text-xl font-bold">見つかりませんでした</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        この記録は削除されたか、開いている画面が古い可能性があります。
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
        <li>ページを再読み込みすると直ることがあります</li>
        <li>
          ホーム画面のアプリから開いている場合は、一度閉じてから開き直してください
        </li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <LinkButton href="/" variant="primary">
          一覧へ
        </LinkButton>
      </div>
      <p className="text-xs text-zinc-500">
        身に覚えのない場合は、この画面が出た時刻を控えておくと原因を追えます（
        <Link href="/" className="underline">
          一覧に戻る
        </Link>
        ）
      </p>
    </div>
  );
}
