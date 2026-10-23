import type { MetadataRoute } from "next";

// 管理画面の色。アイコン（scripts/gen-icons.mjs の ADMIN）と揃える
export const ADMIN_THEME_COLOR = "#1e293b";

/**
 * 管理画面（/admin）を、一般向けの warikan とは別のアプリとしてホーム画面に置くための manifest。
 * id を一般向け（start_url の "/" が id になる）と分けると、ブラウザが別のアプリとして扱う。
 * scope を "/admin/" にすると起動ページの "/admin" 自体が範囲外になるので、末尾の / を付けない
 */
export function adminManifest(): MetadataRoute.Manifest {
  return {
    id: "/admin",
    name: "warikan 管理",
    short_name: "warikan 管理",
    description: "warikan のグループを確かめ、不要なものを削除する管理画面",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    orientation: "portrait",
    lang: "ja",
    background_color: "#f7f8fa",
    theme_color: ADMIN_THEME_COLOR,
    icons: [
      {
        src: "/icons/admin-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/admin-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/admin-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
