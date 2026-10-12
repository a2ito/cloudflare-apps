import type { FieldDef } from "./compare";

/** フォームでのスペック値の入力欄の name */
export function specInputName(fieldId: number): string {
	return `spec_${fieldId}`;
}

/** bool 項目の選択肢の値 */
export const BOOL_YES = "yes";
export const BOOL_NO = "no";

export const SPEC_TEXT_MAX = 100;

export type SpecValueInput = { fieldId: number; valueNum: number | null; valueText: string | null };

/**
 * フォームからスペック値を取り出す。空欄の項目は「未入力」として行を作らない。
 * 0 を未入力と区別したいので、数値は空欄かどうかで判定する
 */
export function parseSpecValues(
	fields: readonly Pick<FieldDef, "id" | "name" | "kind">[],
	formData: FormData,
): { ok: true; values: SpecValueInput[] } | { ok: false; error: string } {
	const values: SpecValueInput[] = [];
	for (const field of fields) {
		const raw = formData.get(specInputName(field.id));
		const text = typeof raw === "string" ? raw.trim() : "";
		if (text === "") continue;

		if (field.kind === "number") {
			// 全角数字や桁区切りのカンマは、スペック表から貼り付けたときによく混ざる
			const normalized = text.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,，]/g, "");
			const n = Number(normalized);
			if (!Number.isFinite(n)) return { ok: false, error: `「${field.name}」は数値で入力してください` };
			values.push({ fieldId: field.id, valueNum: n, valueText: null });
		} else if (field.kind === "bool") {
			if (text !== BOOL_YES && text !== BOOL_NO) return { ok: false, error: `「${field.name}」の値が不正です` };
			values.push({ fieldId: field.id, valueNum: text === BOOL_YES ? 1 : 0, valueText: null });
		} else {
			if (text.length > SPEC_TEXT_MAX) return { ok: false, error: `「${field.name}」は ${SPEC_TEXT_MAX} 文字以内で入力してください` };
			values.push({ fieldId: field.id, valueNum: null, valueText: text });
		}
	}
	return { ok: true, values };
}

/** フォームの初期値。parseSpecValues の逆 */
export function specDefaultValue(kind: FieldDef["kind"], cell: { num: number | null; text: string | null } | undefined): string {
	if (!cell) return "";
	if (kind === "bool") return cell.num === null ? "" : cell.num === 1 ? BOOL_YES : BOOL_NO;
	if (kind === "text") return cell.text ?? "";
	return cell.num === null ? "" : String(cell.num);
}
