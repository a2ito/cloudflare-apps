import { LinkButton } from "@/components/ui";

export const metadata = { title: "オフライン | さけログ" };

/** 圏外のときに Service Worker が代わりに見せるページ。認証は通さない */
export default function OfflinePage() {
  return (
    <div className="space-y-4 rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
      <p className="text-4xl" aria-hidden="true">
        📡
      </p>
      <h1 className="text-lg font-bold">オフラインです</h1>
      <p className="text-sm text-zinc-500">
        電波が戻ったら読み込み直してください。記録はサーバに保存されているので、消えることはありません。
      </p>
      <LinkButton href="/">もう一度開く</LinkButton>
    </div>
  );
}
