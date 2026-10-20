import Link from "next/link";
import { signOutAdmin } from "./actions";

export function AdminHeader({ email }: { email: string }) {
  return (
    <section className="flex items-center gap-3">
      <h1 className="text-2xl font-bold">
        <Link href="/admin">管理画面</Link>
      </h1>
      <div className="ml-auto flex items-center gap-3 text-xs text-black/50">
        <span className="hidden sm:inline">{email}</span>
        <form action={signOutAdmin}>
          <button
            type="submit"
            className="rounded-lg bg-black/5 hover:bg-black/10 px-3 py-1.5 transition-colors"
          >
            ログアウト
          </button>
        </form>
      </div>
    </section>
  );
}
