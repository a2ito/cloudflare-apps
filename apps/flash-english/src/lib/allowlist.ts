/** ALLOWED_EMAILS（カンマ区切り）を正規化した Set にする */
export function parseAllowedEmails(raw: string | undefined | null): ReadonlySet<string> {
	return new Set(
		(raw ?? "")
			.split(",")
			.map((s) => s.trim().toLowerCase())
			.filter((s) => s !== ""),
	);
}

export type SignInCandidate = {
	email: string | null | undefined;
	/** OIDC プロファイルの email_verified。無い場合は undefined */
	emailVerified?: boolean | null;
};

/** 許可リストに載っていて、メール確認済み（または不明）のアカウントだけ通す */
export function isSignInAllowed(candidate: SignInCandidate, allowed: ReadonlySet<string>): boolean {
	const email = (candidate.email ?? "").trim().toLowerCase();
	if (email === "") return false;
	if (candidate.emailVerified === false) return false;
	return allowed.has(email);
}
