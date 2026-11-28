# family-tree

家族で共有して育てる、グラフで見る家系図アプリ。

公開 URL: https://family-tree.a2ito.work （許可された Google アカウントのみログイン可）

## できること

- **家系図を何枚でも持つ** … 父方・母方などを分けて作れる
- **グラフで見る** … 人物をノード、親子・配偶者を線にして、世代ごとに上から並べる。
  ドラッグで移動、ホイール・ピンチで拡大縮小。人を押すと詳細が出る
- **人物を足す・直す** … 名前・よみがな・性別・生没年月日・メモ。選んだ人から「＋親」「＋配偶者」「＋子」で
  つながりごと足せる。家系図にいる 2 人をあとからつなぐ・外すこともできる
- **家族と共有する** … 持ち主がメールアドレスで共有すると、相手も人物とつながりを編集できる

## 設計メモ

- **権限はメールで持つ**（`tree_members`）。共有したい相手がまだ一度もログインしていなくても、
  先に登録しておけるようにするため。ログインできるかどうかは別に `ALLOWED_EMAILS` が決める
- **家系図の中身に触る処理は、必ずメンバーかどうかを確かめてから**（`src/lib/access.ts`）。
  人物・つながりのクエリも `tree_id` で絞り、別の家系図の ID を送られても読ませない・書かせない。
  メンバーでない家系図のページは、存在するかどうかも含めて 404 にする
- **持ち主と編集者**。編集者は人物とつながりを触れる。名前の変更・共有・削除は持ち主だけ
- **生没年月日は「1950」「1950-04」「1950-04-01」のどれでもよい**。昔の人ほど年しか分からないため
- **親は 2 人まで**。子孫を親にする（一周する）つながり、先祖・子孫どうしの配偶者は作らせない
  （`src/lib/relations.ts`）。再婚があるので配偶者の数は制限しない
- **グラフの配置**は [dagre](https://github.com/dagrejs/dagre) で毎回計算し、位置は保存しない。
  夫婦の間に小さな「夫婦ノード」を置き、2 人 → 夫婦ノード → 子 とつなぐ（`src/lib/layout.ts`）。
  描画は [React Flow](https://reactflow.dev)
- **人物を作ってつなぐ処理は 1 つの batch**（D1 のトランザクション）で入れる。
  つながりの無い人物や、持ち主の居ない家系図が残らないように

## 技術構成

| 領域           | 採用技術                                          |
| -------------- | ------------------------------------------------- |
| フレームワーク | Next.js 16 (App Router)                           |
| 実行環境       | Cloudflare Workers ([vinext](https://vinext.dev)) |
| DB             | Cloudflare D1 + Drizzle ORM                       |
| 認証           | better-auth + Google OAuth + 許可メールリスト     |
| グラフ         | React Flow (`@xyflow/react`) + dagre              |
| UI             | Tailwind CSS v4                                   |
| テスト         | Vitest + Miniflare（本物の D1 を起動して検証）    |

## セットアップ

このアプリはモノレポ [cloudflare-apps](../../README.md) の一部。**依存はリポジトリ
直下でまとめて入れる**（lockfile はルートに 1 つしかないため、このディレクトリで
`npm ci` は通らない）。

```bash
# リポジトリ直下で
npm ci

# 以降はこのディレクトリで

# 環境変数
cp .dev.vars.example .dev.vars
# AUTH_SECRET は openssl rand -base64 32 で生成
# AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET は Google Cloud Console で発行
# ALLOWED_EMAILS にログインを許可するメールアドレスをカンマ区切りで記入

# ローカル D1 にマイグレーションを適用
npm run db:migrate:local

npm run dev
```

Google OAuth の承認済みリダイレクト URI には以下を登録する。

- `http://localhost:3000/api/auth/callback/google`（ローカル）
- `https://<公開ホスト名>/api/auth/callback/google`（本番）

## よく使うコマンド

| コマンド                               | 用途                                        |
| -------------------------------------- | ------------------------------------------- |
| `npm run dev`                          | 開発サーバ                                  |
| `npm test`                             | テスト（Miniflare で D1 を起動）            |
| `npm run lint` / `npm run typecheck`   | 静的チェック                                |
| `npm run db:generate`                  | スキーマ変更からマイグレーション SQL を生成 |
| `npm run db:migrate:local` / `:remote` | マイグレーション適用                        |
| `npm run build` / `npm start`          | ビルドして Workers ランタイムでローカル確認 |
| `npm run cf:deploy`                    | Cloudflare へデプロイ                       |

## デプロイ

main への push を Cloudflare の [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
が検知し、ビルドしてデプロイする。設定は Terraform（ルートの `terraform/`）が持つ。

| 項目              | 値                                        |
| ----------------- | ----------------------------------------- |
| Root directory    | `apps/family-tree`                        |
| Build command     | `npm run cf:build`                        |
| Deploy command    | `npm run cf:deploy`                       |
| Git branch        | `main`                                    |
| Build watch paths | `apps/family-tree/*`、`package-lock.json` |
| Build variables   | `D1_DATABASE_ID`, `APP_HOSTNAME`          |

Worker の設定は `cloudflare.config.ts`。実 ID と公開ホスト名はリポジトリに含めず、これらの変数から読む。
読むのは本番のビルド（`vite build` とデプロイ）のときだけで、手元の開発ではシェルに入っていても使わない。
未設定のまま `cf:build` / `cf:deploy` を流すと、最初に止まる（`../../scripts/check-cf-env.mjs`）。

マイグレーションは `npm run cf:deploy` の中でデプロイより先に適用される。カラムやテーブルを消す変更は
2 回に分けて出す（expand / contract）。

### 初回だけ手でやること

D1（`family-tree-db`）は Terraform が作る（`terraform/config_apps.tf` の `d1_databases`）。
ID は apply のあとに `terraform state show 'cloudflare_d1_database.app["family-tree"]'` で調べ、
Build variables の `D1_DATABASE_ID` に書いてもう一度 apply する（`terraform/README.md` の「アプリを足す」）。

ログインのセッションは暗号化した Cookie だけで持つ（better-auth のステートレス構成）。
ログインから 30 日で必ずログインし直しになる。

Secret（`AUTH_SECRET` / `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` / `ALLOWED_EMAILS`）は
Terraform が入れる。名前は `cloudflare.config.ts` の `env` にも `bindings.secret()` で宣言してある。
