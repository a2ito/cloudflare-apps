import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import { APPLE_TOUCH_ICON, PWA_METADATA } from "@/lib/pwa";

export const metadata: Metadata = {
  ...PWA_METADATA,
  title: "Hexspin",
  description:
    "六角形のタイルを 3 枚ずつ回して、同じ色の三角形を作って消すパズル",
  icons: { icon: "/hexspin/favicon.svg", apple: APPLE_TOUCH_ICON },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-dvh antialiased">
        <main className="px-4 py-6">
          <Link
            href="/"
            className="mb-4 inline-block text-sm opacity-70 hover:opacity-100"
          >
            ← ゲーム一覧
          </Link>
          {children}
        </main>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
