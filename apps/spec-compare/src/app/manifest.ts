import type { MetadataRoute } from "next";

/** ブランドカラー。favicon.svg の背景と揃える */
export const THEME_COLOR = "#4f46e5";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "スペック比較",
		short_name: "スペック比較",
		description: "同じカテゴリの商品をスペックと価格で比べるアプリ",
		start_url: "/",
		scope: "/",
		display: "standalone",
		orientation: "portrait",
		lang: "ja",
		theme_color: THEME_COLOR,
		background_color: "#ffffff",
		icons: [
			{ src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{ src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
	};
}
