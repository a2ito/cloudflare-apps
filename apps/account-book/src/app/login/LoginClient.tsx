"use client";

import { useSearchParams } from "next/navigation";

export default function LoginClient() {
  const params = useSearchParams();
  const error = params.get("error");

  const errorMessage = (() => {
    switch (error) {
      // better-auth が errorCallbackURL に付けて返すエラーコード
      // 事前登録されていない・メール未確認（databaseHooks.user.create.before が弾いた）
      case "unable_to_create_user":
        return "このGoogleアカウントは利用できません。";
      // Google の同意画面でキャンセルした
      case "access_denied":
        return "ログインがキャンセルされました。";
      // state Cookie が無い・一致しない（期限切れ、別タブでやり直したなど）
      case "state_mismatch":
      case "state_not_found":
        return "ログインの有効期限が切れました。もう一度お試しください。";
      case null:
        return null;
      default:
        return "Google認証に失敗しました。";
    }
  })();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <h1 className="text-xl font-bold text-center mb-6 text-gray-900 dark:text-gray-100">
          家計簿アプリ ログイン
        </h1>

        {errorMessage && (
          <div className="mb-4 p-3 rounded bg-red-100 text-red-700 text-sm dark:bg-red-900/30 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <a
          href="/api/auth/google"
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          Googleでログイン
        </a>
      </div>
    </div>
  );
}
