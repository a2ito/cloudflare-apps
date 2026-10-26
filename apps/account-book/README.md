# 家計簿アプリ

## 概要

このアプリは **Cloudflare Workers 上で動作する Next.js App Router** を用いた、
**グループ単位で管理できる家計簿アプリ** です。

- Google 認証（事前登録ユーザのみ利用可）
- グループ単位での支出管理
- カテゴリ別集計・ダッシュボード
- レスポンシブ対応（モバイル / PC）

---

## 技術スタック

- **Frontend / Backend**: Next.js (App Router)
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Auth**: Google OAuth 2.0
- **Chart**: Recharts

---

## 主な機能

### 認証

- Google アカウントでログイン
- DB に事前登録されたユーザのみ利用可能
- セッションは Cookie で管理

### グループ管理

- ユーザは 1 つ以上のグループに所属
- 支出（Expenses）は必ずグループに紐づく

### 支出管理

- 支出の登録 / 一覧表示
- カテゴリ別管理
- 月別表示

### サブスク

- 月額・年額のサブスクを登録 / 編集 / 停止 / 削除（`/subscriptions`）
- 請求日を迎えたものを Cron Trigger で毎日 0:05 JST に支出として自動計上する
  - Cron の入口は `worker.ts`（OpenNext の Worker をラップして `scheduled` を足している）
  - 同じサブスク・同じ請求日は一意制約で二重計上しない
  - Cron が止まっても前月（年額は前年）分までは次の実行で取り戻す
  - 手元では `npx wrangler dev --test-scheduled` で起動し、`/__scheduled` を叩くと試せる

### レシート

- 支出の追加・編集で、レシート画像を 1 枚付けられる（差し替え・外すのも編集から）
- 画像はブラウザで長辺 1600px の JPEG に縮めてから送る。サーバは jpeg / png / webp を 5MB まで受け付ける
- 画像は R2 の `account-book-receipts`（バインディング `RECEIPTS_BUCKET`）に置く
  - 公開ドメインは付けない。`/api/expenses/[id]/receipt` が所属グループを確かめてから返す
  - バケットは `terraform/config_apps.tf` の `r2_buckets` が持つ（`public = false`）
- 支出を削除すると、レシート画像も消す

### ダッシュボード

- 月次合計金額
- カテゴリ別集計（円グラフ）

---

## ディレクトリ構成（抜粋）

```
src/
├─ app/
│  ├─ api/
│  │  ├─ auth/google/
│  │  ├─ categories/
│  │  └─ expenses/
│  ├─ login/
│  └─ page.tsx
├─ db/
│  ├─ schema.ts
│  └─ migrate.ts
├─ lib/
│  ├─ auth.ts
│  └─ getUserGroupId.ts
└─ middleware.ts
```

---

## 環境変数

### `.env.local`（ローカル開発）

```env
GOOGLE_CLIENT_ID=xxxxxxxxxxxx
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxx
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

※ `.env.local` は **Git に含めないでください**

---

## ローカル開発

このアプリはモノレポ [cloudflare-apps](../../README.md) の一部。**依存はリポジトリ
直下でまとめて入れる**（lockfile はルートに 1 つしかないため、このディレクトリで
`npm ci` は通らない）。

```bash
# リポジトリ直下で
npm ci
```

以降はこのディレクトリで作業する。

```bash
npm run dev
```

Cloudflare Workers + D1 を使うため、以下も利用します。

```bash
npx wrangler dev
```

---

## DB マイグレーション

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## セキュリティ設計

- OAuth client secret は `.env.local` で管理
- Workers 環境変数は `wrangler secret` を使用
- Cookie は `httpOnly / sameSite=lax`

---

## 今後の予定

- 支出編集 / 削除
- グループ招待機能
- CSV エクスポート
- 年次レポート

---

# Account Book App (Cloudflare Workers + Next.js)

## Overview

This is a **group-based account book application** built with **Next.js App Router** and running on **Cloudflare Workers**.

- Google OAuth authentication (pre-registered users only)
- Expense management per group
- Category-based analytics dashboard
- Fully responsive design

---

## Tech Stack

- **Frontend / Backend**: Next.js (App Router)
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Auth**: Google OAuth 2.0
- **Charts**: Recharts

---

## Features

### Authentication

- Google Sign-In
- Only users registered in DB can access
- Session managed via HTTP-only cookies

### Group-based Management

- Users belong to one or more groups
- Expenses are always scoped to a group

### Expense Management

- Create & list expenses
- Category management
- Monthly filtering

### Dashboard

- Monthly total
- Category breakdown (pie chart)

---

## Environment Variables

```env
GOOGLE_CLIENT_ID=xxxxxxxxxxxx
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxx
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

---

## Development

```bash
npm install
npm run dev
```

For Workers & D1:

```bash
npx wrangler dev
```

---

## Database Migration

マイグレーションファイルの生成:

```bash
npm run drizzle:generate
```

ローカル D1 への適用:

```bash
npm run db:migrate:local
```

本番 D1 への適用は Cloudflare Workers Builds が担当します。
ダッシュボードの Deploy command は `npm run cf:deploy` とし、その中で
`npm run db:migrate:remote` をデプロイより先に実行します。

デプロイと同じコマンドで実行することで、マイグレーションが
完了してからデプロイされる順序を保証しています。
手動で本番へ適用する場合は `npm run db:migrate:remote` を実行します。

---

## Security Notes

- Secrets are stored in `.env.local` or Workers secrets
- Cookies are `httpOnly` and `sameSite=lax`

---

## Roadmap

- Edit / delete expenses
- Group invitations
- CSV export
- Yearly reports

---

## License

MIT
