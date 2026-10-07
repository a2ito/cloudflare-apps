"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutToTop } from "@/app/actions";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const pathname = usePathname();

  // Hide header on homepage (login page)
  if (pathname === "/") {
    return <div className="header-hidden" />;
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 light:bg-white border-b border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="text-xl font-semibold text-zinc-900 dark:text-zinc-100"
        >
          ExamLab
        </Link>
        <nav className="flex items-center space-x-6">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-zinc-200 transition dark:text-zinc-400 dark:hover:text-zinc-200 light:text-zinc-600 light:hover:text-zinc-900"
          >
            ダッシュボード
          </Link>
          <Link
            href="/questions"
            className="text-sm text-zinc-600 hover:text-zinc-900 transition dark:text-zinc-400 dark:hover:text-zinc-200 light:text-zinc-600 light:hover:text-zinc-900"
          >
            問題一覧
          </Link>
          <Link
            href="/exams"
            className="text-sm text-zinc-600 hover:text-zinc-900 transition dark:text-zinc-400 dark:hover:text-zinc-200 light:text-zinc-600 light:hover:text-zinc-900"
          >
            試験管理
          </Link>
          <Link
            href="/categories"
            className="text-sm text-zinc-600 hover:text-zinc-900 transition dark:text-zinc-400 dark:hover:text-zinc-200 light:text-zinc-600 light:hover:text-zinc-900"
          >
            カテゴリ管理
          </Link>
          <ThemeToggle />
          <form action={signOutToTop}>
            <button
              type="submit"
              className="text-sm text-zinc-600 hover:text-zinc-900 transition dark:text-zinc-400 dark:hover:text-zinc-200 light:text-zinc-600 light:hover:text-zinc-900"
            >
              ログアウト
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
