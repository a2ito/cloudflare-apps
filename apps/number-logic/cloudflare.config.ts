import { bindings, defineConfig, defineWorker } from "cf/config";

/**
 * Worker の設定。公開ホスト名は以前から wrangler.jsonc に書いていたもの。
 * カスタムドメインは本番のビルド（mode が production。`vite build` と deploy）のときだけ付ける。
 */
const APP_HOSTNAME = "number-logic.a2ito.work";

export default defineConfig({
  worker: defineWorker(({ mode }) => {
    const production = mode === "production";
    return {
      name: "number-logic",
      entrypoint: "vinext/server/fetch-handler",
      compatibilityDate: "2026-11-10",
      compatibilityFlags: ["global_fetch_strictly_public"],
      assets: {
        htmlHandling: "none",
        notFoundHandling: "none",
        runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
      },
      domains: production ? [APP_HOSTNAME] : [],
      // workers.dev とプレビュー URL は使わない（Terraform の cloudflare_workers_script_subdomain も無効にしている）
      workersDev: false,
      previewUrls: false,
      observability: { enabled: true },
      env: {
        ASSETS: bindings.assets(),
      },
    };
  }),
});
