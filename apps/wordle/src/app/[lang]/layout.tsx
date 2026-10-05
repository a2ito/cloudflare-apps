// app/[lang]/layout.tsx
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { initI18n } from "@/i18n/server";
import { isLang } from "@/i18n/lang";

export async function generateMetadata({
  params,
}: {
  params: { lang: string };
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const i18n = await initI18n(lang);
  const t = i18n.getFixedT(lang);

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${lang}`,
      languages: {
        ja: "/ja",
        en: "/en",
      },
    },
  };
}

// [lang] は 1 階層目の動的セグメントなので、放っておくと /phpinfo や /.s3cfg も
// 「その言語のページ」として 200 で描画される。スキャナには「ファイルがある」と
// 見えて探索を呼び込むため、対応している言語以外は 404 にする。
//
// dynamicParams = false でも同じことができるが、Cache Components を有効にすると
// ビルドが落ちる設定なので使わない（Next.js 16 のドキュメントは notFound() を勧めている）。
export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
