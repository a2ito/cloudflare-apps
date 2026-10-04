# CLAUDE.md

ログイン不要の割り勘アプリ「warikan」。Next.js 16 (App Router) を Cloudflare Workers で動かし、
DB は D1 + Drizzle ORM。技術構成・セットアップ手順は `README.md` を読む。

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

- **グループの URL を知っていることが唯一の権限**。ログインは無い。
  メンバー・立替・レートを読む・書く・消すクエリは、必ず `groupId` を条件に入れる。
  ID だけで引くと、別のグループのデータを URL 越しに触れてしまう
- **金額は通貨の最小単位の整数**（`src/lib/currency.ts`）。浮動小数で計算しない。
  外貨の換算は `src/lib/exchange.ts` に寄せる（BigInt で計算している）
- **為替レートは勝手に更新しない**。通貨の追加時と「最新レートに更新」を押したときだけ取る。
  表示のたびに精算額が変わると、払う額がぶれるため
- **`"use server"` のファイルからは非同期関数しか export できない**。クライアントと
  共有する定数は `src/lib/` に置く
- Service Worker（`public/sw.js`）は HTML をキャッシュしない。古い精算結果を見せないため

- コメントには「なぜそうなっているか」を書く。コードを読めば分かることは書かない

## テスト

- Vitest。拾うのは `src/**/*.test.ts` のみ
- 計算や変換は純粋関数として `src/lib/` に切り出し、そこをテストする

## デプロイ設定

- **`wrangler.jsonc` はコミットしない**。設定を変えるときは `wrangler.jsonc.example` を直す。
  実 ID と公開ホスト名は Workers Builds の Build variables から `cf:config` が埋める
- 手元で `dev`・`db:migrate:local`・`preview` を使うには `wrangler.jsonc` が要る。
  無ければ `D1_DATABASE_ID=local APP_HOSTNAME=localhost npm run cf:config` で作る
- 新しいプレースホルダを足したら、`scripts/gen-wrangler-config.mjs`・README の表・
  ダッシュボードの Build variables をそろえる。どれかが欠けるとデプロイが落ちる

## スキーマ変更

- `npm run db:generate` で生成する。`migrations/` の SQL とスナップショットは手で書かない
- `cf:deploy` が本番 D1 へのマイグレーションを先に流す。**消す変更は 2 回に分ける**（expand / contract）
