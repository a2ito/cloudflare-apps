# flash-english

日本文を見て英文を瞬間的に口に出す「瞬間英作文」の練習帳。

公開 URL: https://flash-english.a2ito.work （許可された Google アカウントのみログイン可）

## できること

- **セット** … 文を教材の章などでまとめる。練習はセットごとにも、全セットまとめてもできる
- **登録** … 日本文・英文・メモ（任意）を 1 文ずつ入れる。スプレッドシートの 2 列を貼り付けて
  まとめて登録もできる（1 行に「日本文 タブ 英文」）
- **練習** … 日本文だけを出す → 英文を口に出す → 「答えを見る」で英文を確かめる → ○×を自分で付ける。
  ×の文は同じ練習の最後にもう一度出る。キーボードでは Space で答え、→ で○、← で×
- **読み上げ** … 答えを見ると英文を読み上げる（練習画面のスイッチでオフにできる）。🔊 か R キーでもう一度聞ける。
  セットの文一覧にも 🔊 がある

## 設計メモ

- **答え合わせは自己採点**。瞬間英作文は口に出す練習で、言い回しが違っても言えていれば○にしてよい。
  タイピングで照合すると表記ゆれで×になり、練習の妨げになるため
- **出題は苦手優先の簡易な間隔反復**（`src/lib/srs.ts`）。○が続くと次に出すまでの間隔を
  1 → 3 → 7 → 14 → 30 → 60 日と伸ばし、×で連続○を 0 に戻してその日のうちにまた出す。
  1 回の練習は 10 問で、期限を過ぎた文を×の多い順・期限の古い順に選び、足りなければ期限の近い文で埋める
- **出題の状態は文の行に持つ**（`due_on`・`streak`・○×の回数）。1 人で使うので、
  練習の履歴を別テーブルに残すほどの用途が無い
- **読み上げはブラウザの音声合成（Web Speech API）**（`src/lib/speech.ts`）。端末の中で完結し、料金も鍵も要らない。
  ネット経由の声だと英文が外部に送られるため、端末内の英語の声を優先して選ぶ。自動読み上げのオン・オフは
  場面で変えるものなので、DB ではなくブラウザ（localStorage）に持つ
- **データは持ち主にしか見せない**。セットも文も `user_id` で絞り、他人の ID を送られても読めず消えない
- **日付は文字列で持つ**（`2026-10-12`）。「今日」だけは Workers が UTC で動くため日本時間で決める
  （`src/lib/date.ts`）

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
D1_DATABASE_ID=<your-d1-id> APP_HOSTNAME=flash-english.example.com npm run cf:config

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
が検知し、ビルドしてデプロイする。Workers Builds の設定と Worker の Secret は
[terraform/](../../terraform) で管理している。

| 項目              | 値                                          |
| ----------------- | ------------------------------------------- |
| Root directory    | `apps/flash-english`                        |
| Build command     | `npm run cf:build`                          |
| Deploy command    | `npm run cf:deploy`                         |
| Git branch        | `main`                                      |
| Build watch paths | `apps/flash-english/*`、`package-lock.json` |
| Build variables   | `D1_DATABASE_ID`, `APP_HOSTNAME`            |

`wrangler.jsonc` は実 ID と公開ホスト名を含むため追跡していない。`npm run cf:config` が
雛形 `wrangler.jsonc.example` のプレースホルダをこれらの変数で埋めて生成する。
手元に `wrangler.jsonc` がある場合は上書きしない。

マイグレーションは `npm run cf:deploy` の中でデプロイより先に適用される。適用からデプロイ完了までの数分間は
「新しいスキーマ + 古いコード」が同時に存在するため、カラムやテーブルを消す変更は
2 回に分けて出す（expand / contract）。

### 初回だけ手でやること

1. `npx wrangler d1 create flash-english-db` で D1 を作る
2. Google OAuth の承認済みリダイレクト URI に本番の URI を足す
3. `terraform/terraform.tfvars` に Secret（`AUTH_SECRET` など 4 つ）と Build variables
   （`D1_DATABASE_ID`・`APP_HOSTNAME`）の値を書き、`terraform/` で `make plan` → `make apply`
4. main に push すると Workers Builds がビルドしてデプロイする
