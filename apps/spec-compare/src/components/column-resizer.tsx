"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { parseColumnWidths, setColumnWidth, type ColumnWidths } from "@/lib/column-widths";

/** これより細くすると数値も読めなくなる */
const MIN_WIDTH = 48;

/**
 * 列幅は画面の広さに合わせて決めたいので、DB ではなく端末（ブラウザ）ごとに覚える。
 * カテゴリごとに列が違うので、キーにカテゴリの ID を入れる
 */
function storageKey(categoryId: number): string {
	return `spec-compare:column-widths:${categoryId}`;
}

function loadWidths(categoryId: number): ColumnWidths {
	try {
		return parseColumnWidths(window.localStorage.getItem(storageKey(categoryId)));
	} catch {
		// プライベートブラウズなどで読めないときは、既定の幅で表示する
		return {};
	}
}

function saveWidth(categoryId: number, column: string, width: number | null): void {
	try {
		const next = setColumnWidth(loadWidths(categoryId), column, width);
		window.localStorage.setItem(storageKey(categoryId), JSON.stringify(next));
	} catch {
		// 保存できない環境では、開いている間だけ幅が変わる
	}
}

/** 列の見出しとセルをすべて同じ幅にする。狭めたときは長い文字を折り返す */
function applyWidth(table: HTMLTableElement, column: string, width: number | null): void {
	const value = width === null ? "" : `${width}px`;
	for (const cell of table.querySelectorAll<HTMLElement>(`[data-col="${CSS.escape(column)}"]`)) {
		cell.style.width = value;
		cell.style.minWidth = value;
		cell.style.maxWidth = value;
		cell.style.whiteSpace = width === null ? "" : "normal";
	}
}

/**
 * 列の見出しの右端に置くつまみ。ドラッグで幅を変え、ダブルクリックで元の幅に戻す。
 * 置く th には relative を付け、同じ列の th / td には data-col を付けておく
 */
export function ColumnResizer({ categoryId, column, label }: { categoryId: number; column: string; label: string }) {
	const ref = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		const table = ref.current?.closest("table");
		const width = loadWidths(categoryId)[column];
		if (table && width !== undefined) applyWidth(table, column, width);
	}, [categoryId, column]);

	const onPointerDown = (e: PointerEvent<HTMLSpanElement>) => {
		const handle = e.currentTarget;
		const th = handle.closest("th");
		const table = handle.closest("table");
		if (!th || !table) return;
		// 見出しのリンク（並べ替え）を押したことにしない
		e.preventDefault();
		e.stopPropagation();

		const startX = e.clientX;
		const startWidth = th.getBoundingClientRect().width;
		let width = startWidth;
		handle.setPointerCapture(e.pointerId);

		const onMove = (ev: globalThis.PointerEvent) => {
			width = Math.max(MIN_WIDTH, Math.round(startWidth + ev.clientX - startX));
			applyWidth(table, column, width);
		};
		const onUp = () => {
			handle.removeEventListener("pointermove", onMove);
			handle.removeEventListener("pointerup", onUp);
			handle.removeEventListener("pointercancel", onUp);
			if (width !== startWidth) saveWidth(categoryId, column, width);
		};
		handle.addEventListener("pointermove", onMove);
		handle.addEventListener("pointerup", onUp);
		handle.addEventListener("pointercancel", onUp);
	};

	const onDoubleClick = () => {
		const table = ref.current?.closest("table");
		if (table) applyWidth(table, column, null);
		saveWidth(categoryId, column, null);
	};

	return (
		<span
			ref={ref}
			role="separator"
			aria-orientation="vertical"
			aria-label={`${label}の列幅`}
			title="ドラッグで列幅を変える（ダブルクリックで元に戻す）"
			onPointerDown={onPointerDown}
			onDoubleClick={onDoubleClick}
			className="absolute top-0 right-0 h-full w-2 cursor-col-resize touch-none select-none hover:bg-indigo-300/60 dark:hover:bg-indigo-700/60"
		/>
	);
}
