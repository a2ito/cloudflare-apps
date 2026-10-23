/** 評価を ★ で表す。未評価なら null */
export function Rating({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  if (!value) return null;
  return (
    <span
      className={`text-amber-500 ${className ?? ""}`}
      title={`評価 ${value} / 5`}
    >
      <span aria-hidden="true">{"★".repeat(value)}</span>
      <span className="sr-only">評価 {value} / 5</span>
    </span>
  );
}
