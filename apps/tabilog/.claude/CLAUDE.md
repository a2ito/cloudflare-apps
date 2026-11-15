# CLAUDE.md

旅行メモアプリ「たびログ」。Next.js 16 (App Router) を Cloudflare Workers で動かし、
DB は D1、写真は R2 に置く。認証は better-auth + Google OAuth、ビルドとデプロイは vinext。
技術構成・セットアップ手順・設計の背景は `README.md` を読む。

このファイルには、毎回思い出してほしい約束だけを書く。

置き場所がリポジトリ直下ではなく `.claude/` なのは、直下の `CLAUDE.md` を
Next.js が自動生成するため `.gitignore` で無視しているから。Claude Code は
`./CLAUDE.md` と `./.claude/CLAUDE.md` のどちらも読む。

## PR の出し方

- **下書きにしない**。最初から Ready で作る
- **ラベルを必ず付ける**
  - 種別（1 つだけ）: `feature`
  - サブ種別（1 つだけ・該当すれば）: `bugfix` / `refactoring`
  - `ai-assisted` は必ず。人がコードを手で直していなければ `ai-generated` も
  - 脆弱性対応のパッケージ更新は `security-dependency-update`
- コミットメッセージ・PR・コード内のコメントは日本語で書く
- 表題は「何をしたか」、本文は「なぜそうしたか」を書く
- Ready にすると auto-merge が予約され、`quality` と `build` が通りしだい squash で
  マージされる。人の目を通したいものだけ Draft にする

## push する前に通すもの

```bash
npm ci

# typecheck は cloudflare.config.ts から Env の型（.cloudflare/types）を作ってから走る
npm run lint && npm run typecheck && npm test
```

クライアントコンポーネントや Server Action を触ったときは `npm run build` も通す。
サーバ専用のモジュールをクライアントから読んでしまう壊れ方は、型チェックでは出ない。

## コードの約束

- **金額は最小通貨単位の整数**（`amount_minor`）。浮動小数の誤差を持ち込まない
- **日時は 2 種類**。`happened_at` は現地の壁時計時刻（変換しない）、`created_at` /
  `updated_at` は監査用の UTC
- **記録の種別は `src/lib/entry-kinds.ts` の 1 か所**。増やすときはここだけ直す
- **外部から貼られた URL は検証してから出す**（`src/lib/map-url.ts`）。そのまま
  リンクにすると `javascript:` を踏ませられる
- **写真の実体は R2、DB にはキーのみ**。外部キーの cascade では R2 は消えないので、
  削除時はアクション側でキーを集めてから消す
- **`src/lib/` は Cloudflare の env に触れるものと触れないものを分ける**。
  クライアントから読むモジュール（`photo-limits` / `entry-kinds` / `map-url` など）は
  env にも drizzle にも触れない。触れるもの（`photos` / `cloudflare`）を
  `"use client"` のファイルから import するとビルドが壊れる
- コメントには「なぜそうなっているか」を書く。コードを読めば分かることは書かない

## テスト

- Vitest。環境は node で、拾うのは `src/**/*.test.ts` のみ（`.tsx` は拾わない）
- D1 / R2 は Miniflare で本物を起動して検証する（`src/test/d1.ts`）。
  マイグレーションは `drizzle/` の SQL をそのまま適用するので、本番とスキーマがずれない
- DOM を動かすテストは持てない。コンポーネントは、壊れると気づきにくい約束だけを
  ソースを読む形のテストで守る（`entry-form.test.ts` / `photo-gallery.test.ts`）

## スキーマ変更

- `npm run db:generate` で生成する。`drizzle/` の SQL とスナップショットは手で書かない
- **消す変更は 2 回に分ける**（expand / contract）。マイグレーションはデプロイの
  直前に当たるため、「新しいスキーマ + 古いコード」が数分間同時に存在する
