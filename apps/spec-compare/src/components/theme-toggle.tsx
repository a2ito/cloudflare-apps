"use client";

import { useEffect, useSyncExternalStore } from "react";
import { nextTheme, parseTheme, resolveTheme, THEME_LABELS, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * localStorage を外部ストアとして購読する。
 * サーバー描画時は設定を知り得ないので system を返し、ハイドレーション後に実値へ切り替わる。
 */
const themeStore = {
	listeners: new Set<() => void>(),

	subscribe(onChange: () => void): () => void {
		themeStore.listeners.add(onChange);
		// 他タブでの変更にも追従する
		window.addEventListener("storage", onChange);
		return () => {
			themeStore.listeners.delete(onChange);
			window.removeEventListener("storage", onChange);
		};
	},

	getSnapshot(): Theme {
		try {
			return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
		} catch {
			return "system";
		}
	},

	getServerSnapshot(): Theme {
		return "system";
	},

	set(theme: Theme): void {
		try {
			localStorage.setItem(THEME_STORAGE_KEY, theme);
		} catch {
			// プライベートモードなどで保存できなくても、今回の表示だけは切り替える
		}
		for (const listener of themeStore.listeners) listener();
	},
};

function applyTheme(theme: Theme): void {
	document.documentElement.dataset.theme = resolveTheme(theme, window.matchMedia(DARK_QUERY).matches);
}

function ThemeIcon({ theme }: { theme: Theme }) {
	const common = {
		width: 18,
		height: 18,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 2,
		strokeLinecap: "round" as const,
		strokeLinejoin: "round" as const,
		"aria-hidden": true,
	};
	if (theme === "light") {
		return (
			<svg {...common}>
				<circle cx="12" cy="12" r="4" />
				<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
			</svg>
		);
	}
	if (theme === "dark") {
		return (
			<svg {...common}>
				<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
			</svg>
		);
	}
	return (
		<svg {...common}>
			<rect x="2" y="4" width="20" height="14" rx="2" />
			<path d="M8 21h8M12 18v3" />
		</svg>
	);
}

export function ThemeToggle() {
	const theme = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot, themeStore.getServerSnapshot);

	// DOM への反映。system のときは OS 側の変更にも追従する
	useEffect(() => {
		applyTheme(theme);
		if (theme !== "system") return;
		const mql = window.matchMedia(DARK_QUERY);
		const onChange = () => applyTheme("system");
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, [theme]);

	const label = `配色: ${THEME_LABELS[theme]}（クリックで切り替え）`;

	return (
		<button
			type="button"
			onClick={() => themeStore.set(nextTheme(theme))}
			title={label}
			aria-label={label}
			className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
		>
			<ThemeIcon theme={theme} />
		</button>
	);
}
