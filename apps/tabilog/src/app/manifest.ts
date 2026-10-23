import type { MetadataRoute } from "next";

/** ホーム画面に追加したときの見た目と起動方法を定義する */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "たびログ",
    short_name: "たびログ",
    description: "旅先で食べたもの・買ったものと、その値段や感想を残すメモ",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ja",
    background_color: "#fafaf9",
    theme_color: "#0284c7",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // 端末ごとの形に切り抜かれるため、余白を持たせた版を別に用意する
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [{ name: "旅行をつくる", url: "/trips/new" }],
  };
}
