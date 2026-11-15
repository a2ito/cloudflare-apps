import { redirect } from "next/navigation";
import { getSessionAdmin } from "@/lib/auth";
import { signInAdmin } from "../actions";

/** requireAdmin と、better-auth が errorCallbackURL に付けて返すエラーコード */
const ERROR_MESSAGES: Record<string, string> = {
  // ログイン済みだが、いまの許可リストに無い（requireAdmin が付ける）
  AccessDenied: "このアカウントには管理画面へのログインが許可されていません",
  // 許可リストに無い（databaseHooks.user.create.before が弾いた）
  unable_to_create_user:
    "このアカウントには管理画面へのログインが許可されていません",
  // Google の同意画面でキャンセルした
  access_denied: "ログインがキャンセルされました",
  // Google のアカウントがメール確認済みでない
  email_not_verified:
    "メールアドレスが確認されていない Google アカウントではログインできません",
  // state Cookie が無い・一致しない（期限切れ、別タブでやり直したなど）
  state_mismatch: "ログインの有効期限が切れました。もう一度お試しください",
  state_not_found: "ログインの有効期限が切れました。もう一度お試しください",
  // Google からの戻りの形が不正（URL を手で開いたなど）
  invalid_callback_request:
    "ログインの手順が正しくありません。もう一度お試しください",
  Default: "ログインに失敗しました。もう一度お試しください",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const errorKey = typeof error === "string" ? error : undefined;
  // 許可リストから外れたセッションは requireAdmin が error 付きでここへ戻すので、そのときは留まる
  if ((await getSessionAdmin()) && !errorKey) redirect("/admin");

  const message = errorKey
    ? (ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.Default)
    : null;

  return (
    <section className="mx-auto mt-10 max-w-sm space-y-6 bg-white rounded-2xl shadow-sm border border-black/5 p-8 text-center">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">管理画面</h1>
        <p className="text-sm text-black/50">
          許可された Google アカウントでログインしてください
        </p>
      </div>
      {message && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600"
        >
          {message}
        </p>
      )}
      <form action={signInAdmin}>
        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
        >
          Google でログイン
        </button>
      </form>
    </section>
  );
}
