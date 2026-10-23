export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = "light" | "dark";

/** localStorage のキー。インラインスクリプトとクライアント側で共有する */
export const THEME_STORAGE_KEY = "sakelog-theme";

export function isTheme(value: unknown): value is Theme {
  return (
    typeof value === "string" && (THEMES as readonly string[]).includes(value)
  );
}

/** 保存値を読み取る。壊れていれば system に倒す */
export function parseTheme(raw: unknown): Theme {
  return isTheme(raw) ? raw : "system";
}

/** 設定と OS の設定から、実際に適用する配色を決める */
export function resolveTheme(
  theme: Theme,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (theme === "system") return systemPrefersDark ? "dark" : "light";
  return theme;
}

/** トグルボタンを押したときの次の設定（light → dark → system → light） */
export function nextTheme(current: Theme): Theme {
  const i = THEMES.indexOf(current);
  return THEMES[(i + 1) % THEMES.length];
}

export const THEME_LABELS: Record<Theme, string> = {
  light: "ライト",
  dark: "ダーク",
  system: "システム",
};

/**
 * <head> で同期実行して data-theme を先に確定させるスクリプト。
 * 描画前に配色を決めることで、リロード時に白 → 黒とちらつくのを防ぐ。
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t!=="light"&&t!=="dark")t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="light";}})();`;
