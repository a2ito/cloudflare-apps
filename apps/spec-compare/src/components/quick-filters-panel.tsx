"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { parseQuickFiltersOpen } from "@/lib/quick-filter-memory";

/** 開け閉めも、選んだ条件と同じく端末（ブラウザ）ごと・カテゴリごとに覚える */
function storageKey(categoryId: number): string {
	return `spec-compare:quick-filters-open:${categoryId}`;
}

/** 同じ画面の中で開け閉めを知らせるイベント */
const CHANGE_EVENT = "spec-compare:quick-filters-open";

function loadOpen(categoryId: number): boolean {
	try {
		return parseQuickFiltersOpen(window.localStorage.getItem(storageKey(categoryId)));
	} catch {
		// プライベートブラウズなどで読めないときは開いておく
		return true;
	}
}

function saveOpen(categoryId: number, open: boolean): void {
	try {
		window.localStorage.setItem(storageKey(categoryId), open ? "1" : "0");
	} catch {
		// 保存できない環境では、開いている間だけ効く
	}
	window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
	window.addEventListener(CHANGE_EVENT, onChange);
	window.addEventListener("storage", onChange);
	return () => {
		window.removeEventListener(CHANGE_EVENT, onChange);
		window.removeEventListener("storage", onChange);
	};
}

/**
 * 簡易フィルタの行をまとめて畳めるようにする。
 * 畳んでも選んだ条件は効いたままなので、選んでいる数を見出しに出して気付けるようにする
 */
export function QuickFiltersPanel({ categoryId, activeCount, children }: { categoryId: number; activeCount: number; children: ReactNode }) {
	// サーバーでは保存値を読めないので、開いた状態で描いてから保存値に合わせる
	const open = useSyncExternalStore(
		subscribe,
		() => loadOpen(categoryId),
		() => true,
	);

	return (
		<details
			className="group"
			open={open}
			onToggle={(e) => {
				// open 属性を描き直したときにも toggle が来るので、変わったときだけ保存する
				if (e.currentTarget.open !== open) saveOpen(categoryId, e.currentTarget.open);
			}}
		>
			<summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-xs text-zinc-500 select-none hover:text-zinc-700 dark:hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
				<span className="inline-block transition-transform group-open:rotate-90">▶</span>
				簡易フィルタ
				{activeCount > 0 && <span className="ml-1 rounded-full bg-indigo-600 px-2 text-white">{activeCount}</span>}
			</summary>
			<div className="mt-1.5">{children}</div>
		</details>
	);
}
