/**
 * サーバーアクションのテスト用ヘルパ。
 * vi.mock はテストファイルのトップレベルにしか書けないため、各テストは
 * `installActionMocks` 相当の 4 つの vi.mock を自分で宣言し、ここの部品を使う。
 */
export const revalidated: string[] = [];

export class RedirectSignal extends Error {
	constructor(public readonly to: string) {
		super(`REDIRECT:${to}`);
	}
}

export const fakeUser = { email: "tester@example.com", name: "Tester", image: null };

/** redirect() で終わるアクションを実行し、遷移先を返す */
export async function expectRedirect(run: () => Promise<unknown>): Promise<string> {
	try {
		await run();
	} catch (e) {
		if (e instanceof RedirectSignal) return e.to;
		throw e;
	}
	throw new Error("redirect が呼ばれませんでした");
}
