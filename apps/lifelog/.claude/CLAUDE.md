# CLAUDE.md

写真付きの日記から始めるライフログアプリ「lifelog」。Next.js 16 (App Router) を Cloudflare Workers で動かす。
DB は D1、写真は R2、認証は better-auth + Google OAuth を使う。ビルドとデプロイは vinext。
技術構成・セットアップ手順・設計の背景は `README.md` を読む。

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

クライアントコンポーネントや Server Action を触ったときは `npm run build` も通す。

## コードの約束

- **日記は持ち主で絞る**。`entries` を読む・書く・消すクエリは必ず `user_id` を条件に入れる。
  写真は `entries` と結んで持ち主を確かめる（`getOwnedPhoto` / `getOwnedPhotoByKey`）
- **写真は公開しない**。`photoUrl()` は必ず `/api/photos` を返す。sakelog のように R2 の
  カスタムドメインから配ると、URL を知っていれば誰でも取れてしまう
- **日時（`happened_at`）は日本時間の壁時計時刻の文字列**。「いま」は `src/lib/datetime.ts` の
  `nowWallClock()` で決める。`new Date()` をそのまま使うと 9 時間ずれる
- **写真は日記を書き込む前に `validatePhotos` で確かめる**。本文だけ保存されて二重登録になるのを防ぐ
- **写真の実体は R2、DB にはキーのみ**。削除時はアクション側でキーを集めてから R2 を消す
- **`"use server"` のファイルからは非同期関数しか export できない**。また、export した関数は
  誰でも呼べる Server Action になるので、必ず `requireUser()` から始める
- **`src/lib/` のうちクライアントから読むもの**（`photo-limits` / `limits` / `shrink-image` /
  `image-size` / `clipboard` / `form`）は env にも drizzle にも触れない
- コメントには「なぜそうなっているか」を書く。コードを読めば分かることは書かない

## テスト

- Vitest。拾うのは `src/**/*.test.ts` のみ
- D1 / R2 は Miniflare で本物を起動して検証する（`src/test/d1.ts`）。マイグレーションは
  `drizzle/` の SQL をそのまま適用する
- DOM を動かすテストは持てない。コンポーネントは、壊れると気づきにくい約束だけを
  ソースを読む形のテストで守る（`photo-gallery.test.ts`）

## スキーマ変更

- `npm run db:generate` で生成する。`drizzle/` の SQL とスナップショットは手で書かない
- **消す変更は 2 回に分ける**（expand / contract）
