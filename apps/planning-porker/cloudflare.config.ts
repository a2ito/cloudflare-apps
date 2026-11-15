import { bindings, defineConfig, defineWorker } from "cf/config";
import { LOCAL_D1_DATABASE_ID } from "../../scripts/d1.mjs";

/**
 * Worker の設定。公開ホスト名は以前から wrangler.jsonc に書いていたもの。
 * カスタムドメインは本番のビルド（mode が production。`vite build` と deploy）のときだけ付ける。
 * D1 の ID は以前から wrangler.jsonc でリポジトリに入れていた値。本番のビルドでだけ使い、
 * 手元の開発・型の生成・ローカルのマイグレーションではローカルの模擬 D1（LOCAL_D1_DATABASE_ID）を使う。
 * CI の起動確認は環境変数 D1_DATABASE_ID でローカルの ID を渡すので、それがあれば優先する。
 */
const APP_HOSTNAME = "porker.a2ito.work";

/** 本番 D1 の ID */
const PRODUCTION_D1_DATABASE_ID = "a2a11d45-42af-4788-a1e5-8a1bef409137";

export default defineConfig({
  worker: defineWorker(({ mode }) => {
    const production = mode === "production";
    return {
      name: "planning-porker",
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
        DB: bindings.d1({
          id: production
            ? process.env.D1_DATABASE_ID || PRODUCTION_D1_DATABASE_ID
            : LOCAL_D1_DATABASE_ID,
          name: "planning-porker-db",
        }),
      },
    };
  }),
});
