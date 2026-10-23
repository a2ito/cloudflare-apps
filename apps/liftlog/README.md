# liftlog

目標を決めて、今日やるメニューの提案を受け、実際に挙げた重量と回数を残す筋トレ記録アプリ。

公開 URL: https://liftlog.a2ito.work （許可された Google アカウントのみログイン可）

## できること

- **目標** … 種目ごとに重量・回数・セット数と、1 回の上げ幅を決める
- **メニュー** … 種目をまとめたメニュー（A・B・C…）を作り、作った順に回す
- **今日のメニュー** … 前回の次のメニューを「今日はこれをやりましょう」と出す。
  予定の重量と回数が入っているので、できた回数に直して記録する。別のメニューにも切り替えられる
- **重量を上げる** … 全セットで目標回数に届いたら、次回の重量が上げ幅だけ増える
- **履歴** … やった日・メニュー・セットごとの重量と回数を振り返る。目標に届かなかったセットは赤で出す

## 設計メモ

- **重量はメニューではなく種目に持たせる**。スクワットを A と B の両方に入れたとき、
  どちらの日にやっても同じ重量から続けられるようにするため
- **次のメニューは「前回より後に作ったメニューのうち最初のもの。無ければ先頭」**
  （`src/lib/training.ts` の `nextMenu`）。前回のメニューを消しても、消えた位置の次から続く
- **重量を上げるのは、予定の重量以上で目標回数に届いたセットが目標のセット数ぶんあったとき**
  （`nextWeight`）。重量を下げてこなした日は据え置く。記録を保存したときに種目の重量を書き換える。
  記録を消しても重量は戻さないので、合わなければ目標の画面で直す
- **履歴には種目名・メニュー名を記録時の名前で写して残す**。種目やメニューを消しても履歴が読める
- **重量は 0.25kg 刻み**。1.25kg のプレートまで扱えれば足り、2 進数で割り切れるので足し続けても誤差が出ない。
  0kg は自重種目で使う。上げ幅 0 なら自動では上げない
- **記録は持ち主にしか見せない**。読む・変える・消すクエリはすべて `user_id` で絞る
- **やった日は日付の文字列で持つ**（`performed_on`、`2026-09-25`）。「今日」は日本時間で決める（`src/lib/date.ts`）

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
D1_DATABASE_ID=<your-d1-id> APP_HOSTNAME=liftlog.example.com npm run cf:config

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

| 項目              | 値                                    |
| ----------------- | ------------------------------------- |
| Root directory    | `apps/liftlog`                        |
| Build command     | `npm run cf:build`                    |
| Deploy command    | `npm run cf:deploy`                   |
| Git branch        | `main`                                |
| Build watch paths | `apps/liftlog/*`、`package-lock.json` |
| Build variables   | `D1_DATABASE_ID`, `APP_HOSTNAME`      |

`wrangler.jsonc` は実 ID と公開ホスト名を含むため追跡していない。`npm run cf:config` が
雛形 `wrangler.jsonc.example` のプレースホルダをこれらの変数で埋めて生成する。
手元に `wrangler.jsonc` がある場合は上書きしない。

マイグレーションは `npm run cf:deploy` の中でデプロイより先に適用される。適用からデプロイ完了までの数分間は
「新しいスキーマ + 古いコード」が同時に存在するため、カラムやテーブルを消す変更は
2 回に分けて出す（expand / contract）。

### 初回だけ手でやること

```bash
npx wrangler d1 create liftlog-db

npx wrangler secret put AUTH_SECRET
npx wrangler secret put AUTH_GOOGLE_ID
npx wrangler secret put AUTH_GOOGLE_SECRET
npx wrangler secret put ALLOWED_EMAILS
```
