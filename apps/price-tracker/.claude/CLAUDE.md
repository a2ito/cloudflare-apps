# CLAUDE.md

商品ごとに店舗別の価格を記録し、単価で最安値を比べるアプリ「price-tracker（最安値メモ）」。
Next.js 16 (App Router) を Cloudflare Workers で動かし、DB は D1 + Drizzle ORM、画像は R2、
認証は Auth.js v5 + Google OAuth（`ALLOWED_EMAILS` の許可リスト）。
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
npm ci

# 初回のみ。wrangler.jsonc は追跡していないので、CI と同じ仮の値で作る
D1_DATABASE_ID=placeholder-database-id APP_HOSTNAME=placeholder.example.com \
  npm run cf:config && npm run cf-typegen

npm run lint && npm run typecheck && npm test
```

## コードの約束

- **ページとサーバーアクションは先頭で `requireUser()` を呼ぶ**。middleware は無いので、
  呼び忘れるとそこだけ認証の外に出る。データに持ち主の列は無く、許可された全員で共有する
- **最安値は荷姿ごとに判定する**。荷姿をまたぐと大容量が常に勝つため。
  「同じ店の最新の記録だけをアクティブにする」判定は `queries.ts` の SQL と `src/lib/price.ts` の
  `activeRecordIds()` の 2 か所にある。変えるときは両方そろえる
- **価格は税込の円の整数**。単価の計算は `src/lib/price.ts` に寄せる
- **フォームから受けた ID は親子関係を確かめる**。`createRecord` は荷姿がその商品のものかを見てから書く
- **R2 の画像は DB を更新したあとに `releaseImage()` で手放す**。移行 0005 で複数の行が同じキーを
  指していることがあり、参照が残っているうちは消さない
- **画像は URL を知っていれば認証なしで取れる**。キーが UUID v4 で推測できないことに頼っている。
  キーの作り方を変えない
- **`imageUrl()` は例外を投げない**。`NEXT_PUBLIC_IMAGES_BASE_URL` は `next build` 時に埋め込まれ、
  無ければ `/api/images` へ落とす。投げると本番のトップページが 500 になった
- **D1 は 1 文のバインド変数が 100 まで**。商品 ID を `IN` で渡さず、商品と同じ条件で絞って引く
- 順序が要る複数の更新は `db.batch` で 1 つのトランザクションにする（`mergeProduct` を参照）
- 外部リンクは http / https だけを通す（`isSafeExternalUrl`）。`javascript:` などを弾くため
- 記録日は `YYYY-MM-DD` の文字列
- Service Worker（`public/sw.js`）は `/_next/static/` しかキャッシュしない。私的なデータを端末に残さず、
  古い価格を見せないため
- **`"use server"` のファイルからは非同期関数しか export できない**。クライアントと
  共有する定数は `src/lib/` に置く

- コメントには「なぜそうなっているか」を書く。コードを読めば分かることは書かない

## テスト

- Vitest。拾うのは `src/**/*.test.ts` のみ
- D1 / R2 は Miniflare で本物を起動して検証する（`src/test/d1.ts`）。マイグレーションは
  `drizzle/` の SQL をそのまま適用する
- サーバーアクションは認証・Cloudflare コンテキスト・`revalidatePath` / `redirect` だけをモックする
  （`src/test/action-mocks.ts`）。`vi.mock` は各テストファイルのトップレベルに書く

## デプロイ設定

- **`wrangler.jsonc` はコミットしない**。設定を変えるときは `wrangler.jsonc.example` を直す。
  実 ID と公開ホスト名は Workers Builds の Build variables から `cf:config` が埋める
- 新しいプレースホルダを足したら、`scripts/gen-wrangler-config.mjs`・README の表・
  Build variables・`.github/workflows/ci.yml` の `env` をそろえる。どれかが欠けるとビルドが落ちる

## スキーマ変更

- `npm run db:generate` で生成する。`drizzle/` のスナップショットは手で書かない
- データを動かす移行（0005・0008 など）は SQL を書いている。移行前の状態から
  `createTestEnvUpTo` で検証する（`src/db/migration.test.ts`）
- `cf:deploy` が本番 D1 へのマイグレーションを先に流す。**消す変更は 2 回に分ける**（expand / contract）
