import type { Metadata } from "next";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExamLab",
  description: "資格学習を、構造化する。",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100 transition-colors duration-200">
        <div className="min-h-screen">
          <Header />
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
