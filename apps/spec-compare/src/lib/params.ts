/** URL の [id] などを正の整数として読む。読めなければ null */
export function parseId(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}
