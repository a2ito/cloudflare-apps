"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * 端末ごとの設定（自動読み上げのオン・オフなど）。localStorage に置く。
 *
 * 電車の中ではオフ、家ではオンのように端末や場面で変えるものなので、DB には持たない。
 * localStorage が使えない環境（プライベートブラウズなど）では既定値のまま動く。
 */

const listeners = new Set<() => void>();

function read(key: string): string | null {
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	window.addEventListener("storage", listener);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", listener);
	};
}

/** オン・オフの設定。サーバーでの描画では既定値を返す */
export function useBooleanPreference(key: string, defaultValue: boolean): [boolean, (value: boolean) => void] {
	const value = useSyncExternalStore(
		subscribe,
		() => {
			const raw = read(key);
			return raw === null ? defaultValue : raw === "1";
		},
		() => defaultValue,
	);
	const set = useCallback(
		(next: boolean) => {
			try {
				window.localStorage.setItem(key, next ? "1" : "0");
			} catch {
				// 保存できなくても、この画面の間だけ効けば足りる
			}
			for (const l of listeners) l();
		},
		[key],
	);
	return [value, set];
}
