import { z } from "zod";
import { isSafeExternalUrl } from "./url";

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
		return { ok: false, error: first ? `${first.path.join(".")}: ${first.message}` : "入力内容が不正です" };
	}
	return { ok: true, data: result.data };
}

const optionalText = z.preprocess(
	(v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
	z.string().trim().max(500).optional(),
);

export const numberFromForm = z.coerce.number();
export const idFromForm = z.coerce.number().int().positive();
export const optionalIdFromForm = z.preprocess(
	(v) => (v === "" || v === undefined || v === null ? undefined : v),
	z.coerce.number().int().positive().optional(),
);
/** 空欄可の外部リンク。http/https のみ受け付ける */
export const optionalUrl = z.preprocess(
	(v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
	z
		.string()
		.trim()
		.max(2000, "リンクが長すぎます")
		.refine(isSafeExternalUrl, "http:// または https:// で始まるリンクを入力してください")
		.optional(),
);

/** 空欄可の正の数。空欄は undefined にする */
export function optionalPositiveNumber(label: string) {
	return z.preprocess(
		(v) => (v === "" || v === undefined || v === null ? undefined : v),
		z.coerce.number().positive(`${label}は 0 より大きい値で入力してください`).optional(),
	);
}

/** 荷姿の入力項目 */
export const variantFields = {
	amount: z.coerce.number().positive("容量は 0 より大きい値で入力してください"),
	count: z.coerce.number().int("入数は整数で入力してください").positive("入数は 1 以上で入力してください").default(1),
};

export { optionalText };
