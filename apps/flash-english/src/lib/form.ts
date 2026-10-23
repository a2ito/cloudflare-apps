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

/** URL のパラメータ（/decks/[id] や ?deck=）を ID として読む。不正なら undefined */
export function parseId(
  value: string | string[] | undefined,
): number | undefined {
  const parsed = idFromForm.safeParse(value);
  return typeof value === "string" && parsed.success ? parsed.data : undefined;
}
