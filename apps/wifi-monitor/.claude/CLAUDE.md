# CLAUDE.md

Wi-Fi の通信状況を記録するアプリ「wifi-monitor」。Next.js 16 (App Router) を Cloudflare Workers で動かし、
DB は D1、認証は better-auth + Google OAuth。ビルドとデプロイは vinext。
計測は端末のエージェントが行い、`POST /api/samples` に端末のトークンで送る。
技術構成・API・セットアップ手順は `README.md` を読む。

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

# typecheck は cloudflare.config.ts から Env の型（.cloudflare/types）を作ってから走る
npm run lint && npm run typecheck && npm test
```

## コードの約束

- **端末は持ち主で絞る**。`devices` を読む・消すクエリは必ず `user_id` を条件に入れる。
  `samples` を端末単位で引くときは、先に `getDevice(db, userId, id)` で持ち主を確かめる
- **ネットワークも持ち主で絞る**。`networks` を読む・変えるクエリは `user_id` を条件に入れる。ネットワーク単位の計測は
  `getNetwork(db, userId, id)` で持ち主を確かめてから引く
- **トークンは保存しない**。DB にはハッシュ（`hashToken`）だけを書き、平文は発行した応答で 1 回だけ返す
- **計測時刻（`measured_at`）は UTC の ISO 文字列**（`toISOString()` の形）。文字列のまま比較・並べ替えするので、
  形をそろえずに入れると順序が狂う
- **受信 API の形は `src/lib/sample-schema.ts`**。エージェントも同じものを使うので、変えるときは後方互換に
- **D1 の 1 文のバインド変数は 100 個まで**。`samples` の一括挿入は `insertSamples` が 9 行ずつに分けている。
  列を足したら `ROWS_PER_INSERT` と、1 回の受信のクエリ数（Free プランは 1 起動 50 まで）を見直す
- **D1 は JS の数値を REAL で渡す**。SQL で整数の割り算をしたい値はバインドせず埋める（`getSeries` の区間幅）
- **`"use server"` のファイルからは非同期関数と型しか export できない**。共有する定数は `src/lib/limits.ts` に置く
- コメントには「なぜそうなっているか」を書く。コードを読めば分かることは書かない

## テスト

- Vitest。拾うのは `src/**/*.test.ts` のみ
- D1 は Miniflare で本物を起動して検証する（`src/test/d1.ts`）。マイグレーションは
  `drizzle/` の SQL をそのまま適用する

## スキーマ変更

- `npm run db:generate` で生成する。`drizzle/` の SQL とスナップショットは手で書かない
- **消す変更は 2 回に分ける**（expand / contract）
