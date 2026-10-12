const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * 外部リンクとして開いてよい URL かを判定する。
 * javascript: や data: など、クリックで任意のコードが動く形式を弾く。
 */
export function isSafeExternalUrl(value: string | null | undefined): boolean {
	if (!value) return false;
	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		return false;
	}
	return ALLOWED_PROTOCOLS.has(parsed.protocol);
}

/** リンクの見出しに使うホスト名。取り出せなければ null */
export function linkHostname(value: string | null | undefined): string | null {
	if (!isSafeExternalUrl(value)) return null;
	try {
		return new URL(value as string).hostname.replace(/^www\./, "");
	} catch {
		return null;
	}
}
