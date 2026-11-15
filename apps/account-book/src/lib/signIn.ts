/** ログインしようとしている Google アカウント（better-auth が渡すユーザ） */
export type SignInCandidate = {
  email: string;
  emailVerified: boolean;
};

/**
 * ログインさせてよいかを決め、よければ users.id を返す。だめなら null。
 *
 * 通すのは、メール確認済みで、users 表に事前登録されたアカウントだけ。
 * Google は確認済みでないメールも返してくるので、確認済みでなければ登録があっても通さない。
 * メールは大文字小文字を区別せずに照合する（better-auth は小文字にしてから渡してくる）。
 */
export async function resolveSignInUid(
  candidate: SignInCandidate,
  findUserIdByEmail: (normalizedEmail: string) => Promise<string | null>,
): Promise<string | null> {
  if (!candidate.emailVerified) return null;
  const email = candidate.email.trim().toLowerCase();
  if (email === "") return null;
  return findUserIdByEmail(email);
}
