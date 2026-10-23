# kcalog

食べたものとカロリーを記録して、1 日の摂取量を振り返るメモアプリ。

公開 URL: https://kcalog.a2ito.work （許可された Google アカウントのみログイン可）

## できること

- **記録** … 食品名と kcal を 1 品ずつ入れる。日付は表示中の日に付く
- **1 日の合計** … その日の記録と合計 kcal を並べる。前日・翌日へ移って過去の日も見返せる
- **削除** … 打ち間違えた記録を消す

## 設計メモ

- **記録は持ち主にしか見せない**。摂取量は人ごとに見るものなので、一覧も削除も
  `user_id` で絞る。他人の記録の ID を送られても消えない
- **食べた日は日付の文字列で持つ**（`eaten_on`、`2026-09-25`）。1 日の合計を出す単位として
  日付があれば足り、タイムゾーン変換もしない。「今日」だけは Workers が UTC で動くため
  日本時間で決める（`src/lib/date.ts`）
- **kcal は整数**。小数まで気にする場面が無いため。0 はお茶などで使うので通し、
  1 万以上は桁の打ち間違いとして弾く

## 技術構成

| 領域           | 採用技術                                                 |
| -------------- | -------------------------------------------------------- |
| フレームワーク | Next.js 16 (App Router)                                  |
| 実行環境       | Cloudflare Workers (OpenNext)                            |
| DB             | Cloudflare D1 + Drizzle ORM                              |
| 認証           | Auth.js (next-auth v5) + Google OAuth + 許可メールリスト |
| UI             | Tailwind CSS v4                                          |
| テスト         | Vitest + Miniflare（本物の D1 を起動して検証）           |

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

# wrangler.jsonc を生成（D1 の ID と公開ホスト名を渡す）
D1_DATABASE_ID=<your-d1-id> APP_HOSTNAME=kcalog.example.com npm run cf:config

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
| `npm run preview`                      | Workers ランタイムでローカル確認            |
| `npm run cf:deploy`                    | Cloudflare へデプロイ                       |

## デプロイ

main への push を Cloudflare の [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
が検知し、ビルドしてデプロイする。設定は Cloudflare ダッシュボードの
**Settings > Build** で行う。

| 項目              | 値                                   |
| ----------------- | ------------------------------------ |
| Root directory    | `apps/kcalog`                        |
| Build command     | `npm run cf:build`                   |
| Deploy command    | `npm run cf:deploy`                  |
| Git branch        | `main`                               |
| Build watch paths | `apps/kcalog/*`、`package-lock.json` |
| Build variables   | `D1_DATABASE_ID`, `APP_HOSTNAME`     |

`wrangler.jsonc` は実 ID と公開ホスト名を含むため追跡していない。`npm run cf:config` が
雛形 `wrangler.jsonc.example` のプレースホルダをこれらの変数で埋めて生成する。
手元に `wrangler.jsonc` がある場合は上書きしない。

マイグレーションは `npm run cf:deploy` の中でデプロイより先に適用される。適用からデプロイ完了までの数分間は
「新しいスキーマ + 古いコード」が同時に存在するため、カラムやテーブルを消す変更は
2 回に分けて出す（expand / contract）。

### 初回だけ手でやること

```bash
npx wrangler d1 create kcalog-db

npx wrangler secret put AUTH_SECRET
npx wrangler secret put AUTH_GOOGLE_ID
npx wrangler secret put AUTH_GOOGLE_SECRET
npx wrangler secret put ALLOWED_EMAILS
```
