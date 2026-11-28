/**
 * サーバーアクションのテスト用ヘルパ。
 * vi.mock はテストファイルのトップレベルにしか書けないため、各テストは
 * 必要な vi.mock を自分で宣言し、ここの部品を使う。
 */
export const revalidated: string[] = [];

export const OWNER = "owner@example.com";
export const EDITOR = "editor@example.com";
export const STRANGER = "stranger@example.com";

/**
 * requireUser() の戻り値。テストの中で email を差し替えて、別の人として操作する。
 * 家系図の権限はメールで決まるので、id は固定でよい。
 */
export const fakeUser = {
  id: 1,
  email: OWNER,
  name: "Tester",
  image: null,
};

export function actAs(email: string): void {
  fakeUser.email = email;
}

/** redirect() は投げて止まる。テストでは行き先を確かめられるように投げ直す */
export class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`redirect: ${url}`);
  }
}
