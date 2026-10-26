# CLAUDE.md

資格試験の問題を試験・日程ごとに管理するアプリ「exam-lab」。Next.js 16 (App Router) を
Cloudflare Workers で動かし、DB は D1 + Drizzle ORM、認証は Auth.js + Google OAuth。
技術構成・セットアップ手順は `README.md` を読む。

このファイルには、毎回思い出してほしい約束だけを書く。

置き場所がアプリ直下ではなく `.claude/` なのは、直下の `CLAUDE.md` を
Next.js が自動生成するため `.gitignore` で無視しているから。

## PR の出し方

- **下書きにしない**。最初から Ready で作る
- **ラベルを必ず付ける**
  - 種別（1 つだけ）: `feature`
  - サブ種別（1 つだけ・該当すれば）: `bugfix` / `refactoring`
  - `ai-assisted` は必ず。人がコードを手で直していなければ `ai-generated` も
  - 脆弱性対応のパッケージ更新は `security-dependency-update`
- コミットメッセージ・PR・コード内のコメントは日本語で書く
- 表題は「何をしたか」、本文は「なぜそうしたか」を書く

## push する前に通すもの

```bash
# 依存はリポジトリ直下で入れる（lockfile はルートに 1 つ）
npm ci

# 以降はこのディレクトリで
npm run lint && npm test && npm run build
```

## コードの約束

- **API route は入り口で必ず `requireApiUser()` を呼ぶ**（`src/lib/auth.ts`）。
  middleware は Cookie の有無を見てログイン画面へ送るだけで、中身は検証しない。
  ページは全てクライアントコンポーネントでデータは API からしか取らないので、守りの本体は API 側
- **ログインできるのは `ALLOWED_EMAILS` のアカウントだけ**。判定は `src/lib/allowlist.ts` の
  `isSignInAllowed` に寄せる。メール未確認のアカウントは通さない
- **問題・試験・分類はユーザごとに分かれていない**。許可された全員で共有するデータなので、
  `user_id` で絞る作りにはなっていない
- `users.id` は Google の `sub`。users 行はログイン時（`jwt` コールバック）にだけ作る。
  毎リクエストで書き込まないため
- **`"use server"` のファイルからは非同期関数しか export できない**（`src/app/actions.ts`）
- Secret（`AUTH_SECRET` など）はリポジトリ直下の `terraform/` で管理する。ローカルは `.dev.vars`

- コメントには「なぜそうなっているか」を書く。コードを読めば分かることは書かない

## テスト

- Vitest。拾うのは `src/**/*.test.ts` のみ
- 判定のような純粋関数を `src/lib/` に切り出し、そこをテストする（例: `allowlist.test.ts`）

## デプロイ設定

- `wrangler.jsonc` はコミットしてある（D1 の ID とホスト名も直接書いている）。設定を変えるときはここを直す
- バインディングを足したら `npm run cf-typegen` で `cloudflare-env.d.ts` を作り直してコミットする

## スキーマ変更

- `src/db/schema.ts` を直し、`npm run drizzle:generate` で生成する。
  `drizzle/migrations/` の SQL とスナップショットは手で書かない
- `cf:deploy` が本番 D1 へのマイグレーションを先に流す。**消す変更は 2 回に分ける**（expand / contract）
- ローカル D1 へは `npm run db:migrate:local`
