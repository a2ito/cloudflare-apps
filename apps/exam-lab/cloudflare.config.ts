import { bindings, defineConfig, defineWorker } from "cf/config";
import { LOCAL_D1_DATABASE_ID } from "../../scripts/d1.mjs";

/**
 * 本番 D1 の ID。exam-lab は Build variables に D1_DATABASE_ID を持たず（terraform/config_apps.tf）、
 * 以前から ID をリポジトリに置いている。package.json の db:migrate:remote も同じ値を使う。
 */
const PRODUCTION_D1_DATABASE_ID = "fd973ecc-ecad-4b93-8fa6-6a8ee576632f";

/**
 * Worker の設定。公開ホスト名はリポジトリに含めず、環境変数から埋める。
 *
 * - APP_HOSTNAME    公開ホスト名（カスタムドメイン）
 * - D1_DATABASE_ID  本番 D1 の ID。未設定なら PRODUCTION_D1_DATABASE_ID（CI は起動確認のためローカルの ID を渡す）
 *
 * 環境変数と本番の ID を使うのは本番のビルド（mode が production。`vite build` と deploy）のときだけ。
 * 手元の開発（`vite dev`）や cf の型の生成・ローカルのマイグレーション（mode なし）では、
 * シェルに本番の値が入っていても使わず、ローカルの値に固定する。
 * 本番のビルドとデプロイは、cf:build / cf:deploy が先に check-cf-env.mjs で未設定を検出して止める。
 */
function resolveDeployment(mode: string | undefined): {
  d1DatabaseId: string;
  appHostname: string | undefined;
} {
  if (mode !== "production") {
    return { d1DatabaseId: LOCAL_D1_DATABASE_ID, appHostname: undefined };
  }
  return {
    d1DatabaseId: process.env.D1_DATABASE_ID || PRODUCTION_D1_DATABASE_ID,
    appHostname: process.env.APP_HOSTNAME || undefined,
  };
}

export default defineConfig({
  worker: defineWorker(({ mode }) => {
    const { d1DatabaseId, appHostname } = resolveDeployment(mode);
    return {
      name: "exam-lab",
      entrypoint: "vinext/server/fetch-handler",
      compatibilityDate: "2026-11-10",
      compatibilityFlags: ["global_fetch_strictly_public"],
      assets: {
        htmlHandling: "none",
        notFoundHandling: "none",
        runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
      },
      // 公開 URL はカスタムドメインのみ。workers.dev とプレビュー URL は、
      // Google の許可リダイレクト URI に含められずログインできないため無効にする
      domains: appHostname ? [appHostname] : [],
      workersDev: false,
      previewUrls: false,
      observability: { enabled: true },
      env: {
        ASSETS: bindings.assets(),
        DB: bindings.d1({ id: d1DatabaseId, name: "exam-lab-db" }),
        // better-auth の baseURL。OAuth のリダイレクト URI（/api/auth/callback/google）はここから組み立てる
        BETTER_AUTH_URL: bindings.text(
          appHostname ? `https://${appHostname}` : "http://localhost:3000",
        ),
        // Worker の secret。値は Terraform が入れる（terraform/config_apps.tf）。
        // ここに無い secret / var はデプロイで消え、値の無い secret を宣言するとデプロイが落ちる。
        AUTH_SECRET: bindings.secret(),
        AUTH_GOOGLE_ID: bindings.secret(),
        AUTH_GOOGLE_SECRET: bindings.secret(),
        ALLOWED_EMAILS: bindings.secret(),
      },
    };
  }),
});
