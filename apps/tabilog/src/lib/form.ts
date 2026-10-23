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
    return {
      ok: false,
      error: first
        ? `${first.path.join(".")}: ${first.message}`
        : "入力内容が不正です",
    };
  }
  return { ok: true, data: result.data };
}

/** 空文字を undefined に寄せた任意テキスト */
export function optionalText(max = 2000) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );
}

export const idFromForm = z.coerce.number().int().positive();
export const optionalIdFromForm = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : v),
  z.coerce.number().int().positive().optional(),
);
