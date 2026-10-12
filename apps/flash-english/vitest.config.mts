import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
		// Miniflare (workerd) の起動があるためデフォルトより長めにとる
		testTimeout: 20_000,
		hookTimeout: 30_000,
	},
});
