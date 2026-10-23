import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ErrorBanner } from "@/components/error-banner";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import { ThemeToggle } from "@/components/theme-toggle";
import { auth, signOut } from "@/lib/auth";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "さけログ",
  description:
    "飲んだお酒の銘柄・造り手・値段・買った場所と、軸ごとの評価を残すメモ",
  applicationName: "さけログ",
  // app/favicon.ico は Next.js が自動で <link> に足すので、ここには書かない。
  // タブやブックマークが高解像度のときに粗くならないよう、大きい PNG も並べる
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // iOS はマニフェストの display を見ないため、こちらで単独起動を指定する
  appleWebApp: { capable: true, title: "さけログ", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e3a5f" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  // ホーム画面から起動したときに端末の表示領域いっぱいに広げる
  viewportFit: "cover",
};

async function Header() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          🍶 さけログ
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link
            href="/guide"
            className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            ガイド
          </Link>
          {user && (
            <>
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
            </>
          )}
          <ThemeToggle />
        </nav>
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
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/* 描画前にテーマを確定させてちらつきを防ぐ */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
        <ServiceWorkerRegistrar />
        <ErrorBanner />
      </body>
    </html>
  );
}
