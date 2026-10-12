/**
 * サーバーアクションのテスト用ヘルパ。
 * vi.mock はテストファイルのトップレベルにしか書けないため、各テストは
 * 必要な vi.mock を自分で宣言し、ここの部品を使う。
 */
export const revalidated: string[] = [];

/** requireUser() の戻り値。id はテスト側で最初に作るユーザに合わせる */
export const fakeUser = { id: 1, email: "tester@example.com", name: "Tester", image: null };
