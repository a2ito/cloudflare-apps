import Link from "next/link";

export const metadata = { title: "オフライン | warikan" };

/** 圏外のときに Service Worker が代わりに見せるページ */
export default function OfflinePage() {
  return (
    <div className="space-y-4 rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center">
      <p className="text-4xl" aria-hidden="true">
        📡
      </p>
      <h1 className="text-lg font-bold">オフラインです</h1>
      <p className="text-sm text-black/60">
        電波が戻ったら読み込み直してください。立替の記録はサーバに保存されているので、消えることはありません。
      </p>
      <Link
        href="/"
        className="inline-block rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
      >
        もう一度開く
      </Link>
    </div>
  );
}
