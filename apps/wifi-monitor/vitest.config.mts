import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // workerd の中でしか解決できないモジュール。テストでは触ると投げるスタブにする
      "cloudflare:workers": fileURLToPath(
        new URL("./src/test/cloudflare-workers.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "agent/src/**/*.test.ts"],
    // Miniflare (workerd) の起動があるためデフォルトより長めにとる
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
