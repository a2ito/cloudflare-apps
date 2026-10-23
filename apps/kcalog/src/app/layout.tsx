import type { Metadata } from "next";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "kcalog",
  description: "食べたものとカロリーを記録して、1 日の摂取量を振り返るメモ",
  applicationName: "kcalog",
};

async function Header() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          🍙 kcalog
        </Link>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-zinc-500 sm:inline">
              {user.name ?? user.email}
            </span>
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
