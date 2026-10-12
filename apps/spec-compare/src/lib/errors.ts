/** エラーとその cause チェーンのメッセージを順に返す（Drizzle は D1 のエラーをラップするため） */
export function errorMessages(e: unknown): string[] {
	const messages: string[] = [];
	const seen = new Set<unknown>();
	let current: unknown = e;
	while (current instanceof Error && !seen.has(current)) {
		seen.add(current);
		messages.push(current.message);
		current = current.cause;
	}
	return messages;
}

export function errorChainMatches(e: unknown, pattern: RegExp): boolean {
	return errorMessages(e).some((m) => pattern.test(m));
}

export function isUniqueViolation(e: unknown): boolean {
	return errorChainMatches(e, /UNIQUE constraint failed/i);
}

export function isForeignKeyViolation(e: unknown): boolean {
	return errorChainMatches(e, /FOREIGN KEY constraint failed/i);
}
