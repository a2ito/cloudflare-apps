import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { signInWithGoogle } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "このアカウントにはアクセス権がありません",
  Configuration: "認証の設定に問題があります。管理者に連絡してください",
  Default: "ログインに失敗しました。もう一度お試しください",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user?.email) redirect("/dashboard");

  const { error } = await searchParams;
  const errorKey = typeof error === "string" ? error : undefined;
  const message = errorKey
    ? (ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.Default)
    : null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="w-full max-w-md px-6">
        <div className="rounded-2xl bg-zinc-900 shadow-lg p-8 space-y-6">
          <header className="space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight">ExamLab</h1>
            <p className="text-sm text-zinc-400">資格学習を、構造化する。</p>
          </header>

          <section className="space-y-4">
            <p className="text-sm text-zinc-300 text-center">
              このアプリは、事前に許可されたユーザーのみ利用できます。
            </p>

            {message && (
              <p
                role="alert"
                className="rounded-md border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300 text-center"
              >
                {message}
              </p>
            )}

            <form action={signInWithGoogle} className="flex justify-center">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-zinc-800 px-6 py-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-700 transition"
              >
                Google でログイン
              </button>
            </form>
          </section>
        </div>

        <footer className="mt-6 text-center text-xs text-zinc-500">
          © ExamLab
        </footer>
      </div>
    </main>
  );
}
