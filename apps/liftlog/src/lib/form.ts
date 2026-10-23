import { z } from "zod";

export type ActionState = { error?: string; success?: string };

export const initialActionState: ActionState = {};

/** FormData を Zod スキーマで検証し、失敗時は先頭のメッセージを返す */
export function parseForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
): { ok: true; data: z.infer<T> } | { ok: false; error: string } {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    raw[key] = value;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, error: first ? first.message : "入力内容が不正です" };
  }
  return { ok: true, data: result.data };
}

export const idFromForm = z.coerce.number().int().positive();

/**
 * 数値の欄。z.coerce.number() だと空欄が 0 として通ってしまうため、空欄は先に弾く。
 * 範囲などの条件は refine で数値のスキーマに足す。
 */
export function numberField(
  label: string,
  refine: (n: z.ZodNumber) => z.ZodType<number, number> = (n) => n,
) {
  return z
    .string({ error: `${label}を入力してください` })
    .trim()
    .min(1, `${label}を入力してください`)
    .transform(Number)
    .pipe(refine(z.number({ error: `${label}は数値で入力してください` })));
}
