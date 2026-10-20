import type { Metadata, Viewport } from "next";
import { ADMIN_THEME_COLOR } from "@/lib/admin-manifest";

// 全体の manifest・ホーム画面の名前・色を、/admin の下では管理画面用に差し替える。
// そうすると /admin を開いてインストールしたときに、一般向けとは別のアプリになる
export const metadata: Metadata = {
  title: "管理 | warikan",
  robots: { index: false, follow: false },
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: { capable: true, title: "warikan 管理", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: ADMIN_THEME_COLOR,
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
