/**
 * サーバーアクションのテスト用ヘルパ。
 * vi.mock はテストファイルのトップレベルにしか書けないため、各テストは
 * 必要な vi.mock を自分で宣言し、ここの部品を使う。
 */
export const revalidated: string[] = [];

export class RedirectSignal extends Error {
  constructor(public readonly to: string) {
    super(`REDIRECT:${to}`);
  }
}

/** requireUser() の戻り値。id はテスト側で最初に作るユーザに合わせる */
export const fakeUser = {
  id: 1,
  email: "tester@example.com",
  name: "Tester",
  image: null,
};

/** redirect() で終わるアクションを実行し、遷移先を返す */
export async function expectRedirect(
  run: () => Promise<unknown>,
): Promise<string> {
  try {
    await run();
  } catch (e) {
    if (e instanceof RedirectSignal) return e.to;
    throw e;
  }
  throw new Error("redirect が呼ばれませんでした");
}
