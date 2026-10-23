/**
 * 読み込み中に出す骨組み。
 *
 * 画面が前のページのまま固まって見えるのを防ぐのが目的なので、
 * 実物と同じ大きさ・同じ並びにして、表示が切り替わったときに
 * 中身だけが入れ替わったように見せる。
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800 ${className}`}
    />
  );
}

/** 旅行一覧のカード */
export function TripCardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-baseline justify-between gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-4 w-56" />
    </div>
  );
}

/** 記録のカード（左にサムネイル、右に題名と金額） */
export function EntryCardSkeleton() {
  return (
    <div className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <Skeleton className="h-20 w-20 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-16 shrink-0" />
    </div>
  );
}

/** 入力欄が縦に並ぶフォーム */
export function FormSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-32" />
    </div>
  );
}
