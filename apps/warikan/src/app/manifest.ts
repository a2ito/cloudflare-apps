import type { MetadataRoute } from "next";

/** ホーム画面に追加したときの見た目と起動方法を定義する */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "warikan | みんなで割り勘",
    short_name: "warikan",
    description:
      "ログイン不要。旅行やイベントの立替を記録して、最小回数で精算できる割り勘アプリ。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ja",
    background_color: "#f7f8fa",
    theme_color: "#10b981",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // 端末ごとの形に切り抜かれるため、余白を持たせた版を別に用意する
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
