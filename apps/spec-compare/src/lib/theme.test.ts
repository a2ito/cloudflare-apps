import { describe, expect, it } from "vitest";
import { isTheme, nextTheme, parseTheme, resolveTheme, THEME_INIT_SCRIPT, THEME_STORAGE_KEY, THEMES } from "./theme";

describe("parseTheme / isTheme", () => {
	it("既知の値はそのまま返す", () => {
		for (const t of THEMES) expect(parseTheme(t)).toBe(t);
	});
	it("未知の値・null・型違いは system に倒す", () => {
		expect(parseTheme("solarized")).toBe("system");
		expect(parseTheme(null)).toBe("system");
		expect(parseTheme(undefined)).toBe("system");
		expect(parseTheme(1)).toBe("system");
	});
	it("isTheme は型ガードとして働く", () => {
		expect(isTheme("dark")).toBe(true);
		expect(isTheme("DARK")).toBe(false);
	});
});

describe("resolveTheme", () => {
	it("明示指定は OS 設定より優先する", () => {
		expect(resolveTheme("light", true)).toBe("light");
		expect(resolveTheme("dark", false)).toBe("dark");
	});
	it("system は OS 設定に従う", () => {
		expect(resolveTheme("system", true)).toBe("dark");
		expect(resolveTheme("system", false)).toBe("light");
	});
});

describe("nextTheme", () => {
	it("light → dark → system → light と循環する", () => {
		expect(nextTheme("light")).toBe("dark");
		expect(nextTheme("dark")).toBe("system");
		expect(nextTheme("system")).toBe("light");
	});
	it("3 回押すと元に戻る", () => {
		expect(nextTheme(nextTheme(nextTheme("light")))).toBe("light");
	});
});

describe("THEME_INIT_SCRIPT", () => {
	it("保存済みの設定を data-theme に反映する", () => {
		const doc = { documentElement: { dataset: {} as Record<string, string> } };
		runInitScript(doc, { stored: "dark", prefersDark: false });
		expect(doc.documentElement.dataset.theme).toBe("dark");
	});
	it("未設定なら OS の設定を使う", () => {
		const doc = { documentElement: { dataset: {} as Record<string, string> } };
		runInitScript(doc, { stored: null, prefersDark: true });
		expect(doc.documentElement.dataset.theme).toBe("dark");
	});
	it("system を保存していても OS の設定を見る", () => {
		const doc = { documentElement: { dataset: {} as Record<string, string> } };
		runInitScript(doc, { stored: "system", prefersDark: true });
		expect(doc.documentElement.dataset.theme).toBe("dark");
	});
	it("localStorage が使えなくても落ちず light になる", () => {
		const doc = { documentElement: { dataset: {} as Record<string, string> } };
		runInitScript(doc, { stored: null, prefersDark: false, throwOnStorage: true });
		expect(doc.documentElement.dataset.theme).toBe("light");
	});
	it("保存キーが定数と一致している", () => {
		expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
	});
});

/** インラインスクリプトを偽の window / document 上で実行する */
function runInitScript(
	doc: { documentElement: { dataset: Record<string, string> } },
	opts: { stored: string | null; prefersDark: boolean; throwOnStorage?: boolean },
): void {
	const window = {
		matchMedia: (q: string) => ({ matches: q.includes("dark") && opts.prefersDark }),
		localStorage: {
			getItem: () => {
				if (opts.throwOnStorage) throw new Error("blocked");
				return opts.stored;
			},
		},
	};
	new Function("window", "document", "localStorage", THEME_INIT_SCRIPT)(window, doc, window.localStorage);
}
