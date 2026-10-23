import type { MetadataRoute } from "next";

/** ブランドカラー。favicon.svg の背景と揃える */
export const THEME_COLOR = "#059669";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "最安値メモ",
    short_name: "最安値メモ",
    description: "商品の最安値と容量あたり単価を記録するアプリ",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ja",
    theme_color: THEME_COLOR,
    background_color: "#ffffff",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
