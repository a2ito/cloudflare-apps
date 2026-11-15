export function StatusBadge({ online }: { online: boolean }) {
  return online ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
      <span aria-hidden="true">●</span>オンライン
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      <span aria-hidden="true">●</span>オフライン
    </span>
  );
}
