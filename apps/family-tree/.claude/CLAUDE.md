# CLAUDE.md

家系図アプリ「family-tree」。Next.js 16 (App Router) を Cloudflare Workers で動かし、
DB は D1、認証は better-auth + Google OAuth。ビルドとデプロイは vinext。グラフは React Flow + dagre。
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

# typecheck は cloudflare.config.ts から Env の型（.cloudflare/types）を作ってから走る
npm run lint && npm run typecheck && npm test
```

## コードの約束

- **家系図の中身に触るときは、必ず先に権限を確かめる**。サーバーアクションは `accessFromForm`、
  ページは `treeAccessFromParams` を通す。人物・つながりのクエリは `tree_id` を条件に入れ、
  別の家系図の人物の ID を混ぜられても触らない
- **権限はメール（小文字）で持つ**。`users.id` では判定しない
- **つながりを足す前に `src/lib/relations.ts` で確かめる**（親は 2 人まで・一周しない・先祖と配偶者にしない）
- **人物とつながりを一緒に作るときは 1 つの batch** にする（`createRelative`）。途中で失敗して
  つながりの無い人物が残らないように
- **D1 は 1 文 100 バインドまで**。`inArray` に件数の読めない配列を渡さない（Miniflare では落ちない）
- **React Flow の nodes は `useNodesState` で持つ**。作り直した配列を直接渡すと、測ったノードの大きさが
  捨てられ、更新のあとに線が一部描かれなくなる
- **入力欄の多いフォームは `submitKeepingValues`（`src/components/ui.tsx`）で送る**。`<form action>` のままだと、
  エラーを返したときも入力が初期値に戻る
- **親子・配偶者の INSERT は、親の人数と重複を SQL の中でも確かめる**（`addParentLink` / `createRelative`）。
  同時に操作されると、アプリ側で確かめた時点の状態が古くなる
- **`"use server"` のファイルからは非同期関数しか export できない**。クライアントと
  共有する定数は `src/lib/constants.ts` に置く

- コメントには「なぜそうなっているか」を書く。コードを読めば分かることは書かない

## テスト

- Vitest。拾うのは `src/**/*.test.ts` のみ
- D1 は Miniflare で本物を起動して検証する（`src/test/d1.ts`）。マイグレーションは
  `drizzle/` の SQL をそのまま適用する
- 別の人として操作するときは `src/test/action-mocks.ts` の `actAs` を使う

## スキーマ変更

- `npm run db:generate` で生成する。`drizzle/` の SQL とスナップショットは手で書かない
- **消す変更は 2 回に分ける**（expand / contract）
