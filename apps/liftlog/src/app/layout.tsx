import type { Metadata } from "next";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "liftlog",
  description:
    "目標を決めて今日のメニューを提案し、実際の重量と回数を残す筋トレ記録",
  applicationName: "liftlog",
};

const NAV = [
  { href: "/", label: "今日" },
  { href: "/plan", label: "目標" },
  { href: "/history", label: "履歴" },
] as const;

async function Header() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          🏋️ liftlog
        </Link>
        {user && (
          <div className="flex items-center gap-4 text-sm">
            <nav className="flex gap-3">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="font-medium text-zinc-600 hover:text-sky-600 dark:text-zinc-300"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                ログアウト
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-dvh antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
