# CLAUDE.md

同じカテゴリの商品をスペックと価格で比べるアプリ「spec-compare」。Next.js 16 (App Router) を
Cloudflare Workers で動かし、DB は D1、画像は R2、認証は Auth.js + Google OAuth。
技術構成・セットアップ手順は `README.md` を読む。

このファイルには、毎回思い出してほしい約束だけを書く。

置き場所がリポジトリ直下ではなく `.claude/` なのは、直下の `CLAUDE.md` を
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
npm ci

# 初回のみ。wrangler.jsonc と cloudflare-env.d.ts が無いと typecheck が落ちる
D1_DATABASE_ID=placeholder-database-id APP_HOSTNAME=placeholder.example.com \
  npm run cf:config && npm run cf-typegen

npm run lint && npm run typecheck && npm test
```

## コードの約束

- **比較の計算（絞り込み・並べ替え・最良値・順位・コスパ）は `src/lib/compare.ts` に閉じ込める**。
  DB を触らない純粋な関数にしてテストする
- **スペック値はカテゴリの項目から読む**。フォームの `spec_<id>` を拾うときは `listFields` で
  そのカテゴリの項目を引いてから `parseSpecValues` に渡す。送られてきた id をそのまま信じない
- **D1 は 1 文のバインド変数が 100 まで**。商品 ID を `IN` で渡さず、カテゴリで絞って引く。
  まとめて入れるときは行を分ける（`products.ts` の `SPEC_INSERT_CHUNK`）
- **R2 の画像は DB を更新したあとに消す**。先に消すと、失敗したときに画像の無い商品が残る
- **日付は文字列**（`2026-10-12`）。「今日」は `src/lib/date.ts` の `today()` で日本時間から決める
- **`"use server"` のファイルからは非同期関数しか export できない**。クライアントと
  共有する定数は `src/lib/` に置く

- コメントには「なぜそうなっているか」を書く。コードを読めば分かることは書かない

## テスト

- Vitest。拾うのは `src/**/*.test.ts` のみ
- D1 / R2 は Miniflare で本物を起動して検証する（`src/test/d1.ts`）。マイグレーションは
  `drizzle/` の SQL をそのまま適用する

## スキーマ変更

- `npm run db:generate` で生成する。`drizzle/` の SQL とスナップショットは手で書かない
- **消す変更は 2 回に分ける**（expand / contract）
