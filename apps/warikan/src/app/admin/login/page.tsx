import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { signInAdmin } from "../actions";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "このアカウントには管理画面へのログインが許可されていません",
  Configuration: "認証の設定に問題があります",
  Default: "ログインに失敗しました。もう一度お試しください",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const errorKey = typeof error === "string" ? error : undefined;
  const session = await auth();
  // 許可リストから外れたセッションは requireAdmin が error 付きでここへ戻すので、そのときは留まる
  if (session?.user?.email && !errorKey) redirect("/admin");

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
