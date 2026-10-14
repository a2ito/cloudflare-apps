/** 列のキー（price / cost / f<id>）→ 幅（px） */
export type ColumnWidths = Record<string, number>;

/** 保存してある列幅を読む。壊れた値や数でない幅は捨てる（手で書き換えられても表示が崩れないように） */
export function parseColumnWidths(raw: string | null): ColumnWidths {
	if (raw === null) return {};
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {};
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
	return Object.fromEntries(
		Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] > 0),
	);
}

/** 1 列の幅を差し替えた新しい対応表を返す。null なら保存した幅を消して元に戻す */
export function setColumnWidth(widths: ColumnWidths, column: string, width: number | null): ColumnWidths {
	const rest = Object.fromEntries(Object.entries(widths).filter(([key]) => key !== column));
	return width === null ? rest : { ...rest, [column]: Math.round(width) };
}
