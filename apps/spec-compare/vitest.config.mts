import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	test: {
		environment: "node",
		// imageUrl がビルド時に埋め込まれる基底 URL を要求する
		env: { NEXT_PUBLIC_IMAGES_BASE_URL: "https://images.example.com" },
		include: ["src/**/*.test.ts"],
		// Miniflare (workerd) の起動があるためデフォルトより長めにとる
		testTimeout: 20_000,
		hookTimeout: 30_000,
	},
});
