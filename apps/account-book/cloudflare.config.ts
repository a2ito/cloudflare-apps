import { bindings, defineConfig, defineWorker, triggers } from "cf/config";
import { LOCAL_D1_DATABASE_ID } from "../../scripts/d1.mjs";

/**
 * Worker の設定。公開ホスト名と本番 D1 の ID は、以前から wrangler.jsonc でリポジトリに入れていた値。
 * カスタムドメインと本番 D1 は本番のビルド（mode が production。`vite build` と deploy）のときだけ使い、
 * 手元の開発・型の生成・ローカルのマイグレーションではローカルの模擬 D1（LOCAL_D1_DATABASE_ID）を使う。
 * CI の起動確認は環境変数 D1_DATABASE_ID でローカルの ID を渡すので、それがあれば優先する。
 */
const APP_HOSTNAME = "account-book.a2ito.work";

/** 本番 D1 の ID */
const PRODUCTION_D1_DATABASE_ID = "7d4e8877-df52-45d0-854e-1472becc8b17";

export default defineConfig({
  worker: defineWorker(({ mode }) => {
    const production = mode === "production";
    return {
      name: "account-book",
      // vinext のハンドラに、サブスクを計上する Cron の入口を足したもの
      entrypoint: "./worker/index.ts",
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
      // 毎日 0:05（JST）。サブスクの支払日になった分を支出に計上する
      triggers: [triggers.scheduled({ schedule: "5 15 * * *" })],
      env: {
        ASSETS: bindings.assets(),
        DB: bindings.d1({
          id: production
            ? process.env.D1_DATABASE_ID || PRODUCTION_D1_DATABASE_ID
            : LOCAL_D1_DATABASE_ID,
          name: "account-book-db",
        }),
        // レシート画像。公開ドメインは付けず、Worker が認証してから返す
        RECEIPTS_BUCKET: bindings.r2({ name: "account-book-receipts-apac" }),
        // better-auth の baseURL。Google のリダイレクト URI（/api/auth/google/callback）もここから組み立てる
        ORIGIN: bindings.text(
          production ? `https://${APP_HOSTNAME}` : "http://localhost:3000",
        ),
        // Worker の secret。値は Terraform が入れる（terraform/config_apps.tf）。
        // セッションの署名鍵は GOOGLE_CLIENT_SECRET から作る（専用の secret を足すと、
        // デプロイより先に Terraform で値を入れる順序が要るため）
        GOOGLE_CLIENT_ID: bindings.secret(),
        GOOGLE_CLIENT_SECRET: bindings.secret(),
      },
    };
  }),
});
