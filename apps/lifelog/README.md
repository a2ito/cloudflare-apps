# lifelog

日々の出来事を写真付きの日記として残すライフログアプリ。まずは日記から始める。

公開 URL: https://lifelog.a2ito.work （許可された Google アカウントのみログイン可）

## できること

- **日記** … 日時と本文を書く。1 日に何件でも書ける。写真だけの日記も書ける
- **写真** … 1 件に 8 枚まで付けられる。あとから編集で足せる。拡大表示とダウンロードも可能。
  送信前にブラウザで長辺 1600px へ縮小する。画像を貼り付けても追加できる
- **一覧** … 新しい順に日ごとにまとめて並べる。30 件ずつ読み込む
- **編集・削除** … 日記の書き直し、写真 1 枚ごとの削除、日記ごとの削除

## 設計メモ

- **日記は持ち主にしか見せない**。`entries` を読む・書く・消すクエリは必ず `user_id` で絞る。
  写真は `entries` と結んで持ち主を確かめる。他人の ID を送られても何も起きない
- **写真は公開しない**。sakelog や tabilog は R2 のカスタムドメインから CDN で直接
  配っているが、その方式だと URL を知っていれば誰でも写真を取れる。日記の写真は私的な
  ものなので、`/api/photos` がログインと持ち主を確かめてから返す。利用者は 1 人なので、
  写真ごとに Worker が起動しても負荷は問題にならない。キャッシュは `private` にして、
  共有キャッシュには載せない
- **日時は日本時間の壁時計時刻で持つ**（`happened_at`、`2026-09-25T12:30`）。
  `<input type="datetime-local">` の値をそのまま保存し、タイムゾーン変換はしない。
  文字列の並びがそのまま時系列になる。Workers は UTC で動くため、新規入力の初期値だけは
  日本時間で決める（`src/lib/datetime.ts`）
- **写真は日記を書き込む前に確かめる**。写真が駄目なのに本文だけ保存されると、
  送り直したときに同じ日記が 2 件になるため
- **写真の実体は R2、DB にはキーのみ**。外部キーの cascade では R2 の実体は消えないので、
  削除のときはアクション側でキーを集めてから消す
- **一覧はカーソルでページ送りする**（`?before=<日時>_<id>`）。同じ時刻の日記が
  ページの境目にあっても取りこぼさないよう、id も合わせて持つ

## 技術構成

| 領域           | 採用技術                                                 |
| -------------- | -------------------------------------------------------- |
| フレームワーク | Next.js 16 (App Router / Server Actions)                 |
| 実行環境       | Cloudflare Workers (OpenNext)                            |
| DB             | Cloudflare D1 + Drizzle ORM                              |
| 写真           | Cloudflare R2                                            |
| 認証           | Auth.js (next-auth v5) + Google OAuth + 許可メールリスト |
| UI             | Tailwind CSS v4                                          |
| テスト         | Vitest + Miniflare（本物の D1 / R2 を起動して検証）      |

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
D1_DATABASE_ID=<your-d1-id> APP_HOSTNAME=lifelog.example.com npm run cf:config

# ローカル D1 にマイグレーションを適用
npm run db:migrate:local

npm run dev
```

手元では、写真は Miniflare のローカル R2 に入る。

Google OAuth の承認済みリダイレクト URI には以下を登録する。

- `http://localhost:3000/api/auth/callback/google`（ローカル）
- `https://<公開ホスト名>/api/auth/callback/google`（本番）

## よく使うコマンド

| コマンド                               | 用途                                        |
| -------------------------------------- | ------------------------------------------- |
| `npm run dev`                          | 開発サーバ                                  |
| `npm test`                             | テスト（Miniflare で D1 / R2 を起動）       |
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
| Root directory    | `apps/lifelog`                        |
| Build command     | `npm run cf:build`                    |
| Deploy command    | `npm run cf:deploy`                   |
| Git branch        | `main`                                |
| Build watch paths | `apps/lifelog/*`、`package-lock.json` |
| Build variables   | `D1_DATABASE_ID`, `APP_HOSTNAME`      |

`wrangler.jsonc` は実 ID と公開ホスト名を含むため追跡していない。`npm run cf:config` が
雛形 `wrangler.jsonc.example` のプレースホルダをこれらの変数で埋めて生成する。
手元に `wrangler.jsonc` がある場合は上書きしない。

マイグレーションは `npm run cf:deploy` の中でデプロイより先に適用される。適用からデプロイ完了までの数分間は
「新しいスキーマ + 古いコード」が同時に存在するため、カラムやテーブルを消す変更は
2 回に分けて出す（expand / contract）。

### 初回だけ手でやること

D1 と R2 は、日本から近いよう APAC を指定して作る。R2 バケットにカスタムドメインや
公開アクセスは設定しない（写真は `/api/photos` からだけ返す）。

```bash
npx wrangler d1 create lifelog-db --location apac
npx wrangler r2 bucket create lifelog-photos --location apac

npx wrangler secret put AUTH_SECRET --name lifelog
npx wrangler secret put AUTH_GOOGLE_ID --name lifelog
npx wrangler secret put AUTH_GOOGLE_SECRET --name lifelog
npx wrangler secret put ALLOWED_EMAILS --name lifelog
```
