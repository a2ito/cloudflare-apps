# CLAUDE.md

ログイン不要のプランニングポーカー「planning-porker」。Next.js 16 (App Router) を
Cloudflare Workers で動かし、DB は D1 + Drizzle ORM。Durable Objects や WebSocket は使っていない。
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

# 以降はこのディレクトリで。typecheck と test のスクリプトは無い
npm run lint && npm run build
```

## コードの約束

- **ルームの URL を知っていることが唯一の権限**。ログインは無い。
  参加者・投票を読む・書く・消すクエリは、必ず `roomId` を条件に入れる。
  ID だけで引くと、別のルームのデータを URL 越しに触れてしまう
- **参加者は名前で識別する**。名前は `localStorage` の `planning-poker:<roomId>` に置くだけで、
  本人確認は無い。同じルームに同じ名前で入ると、新しい行は作らず既存の参加者になる
- **`participants` と `votes` は外部キーで繋がっていない**。`(room_id, 名前)` で紐づくだけなので、
  参加者を消すときは同じ条件で `votes` も消す（`leave-actions.ts`）。残すと幽霊の票が数えられる
- 画面は `/api/room/[id]` が `RoomData`（`src/types/room.ts`）に整形した状態だけを見る。
  `votes` の `value` が null の行は未投票として返さない
- 他の人の操作は `PollingRefresher` の 3 秒ごとの更新と、自分の操作後の再取得で拾う。
  ポーリングは参加者が 2 人以上で、タブが表示されているときだけ回す
- `vote` / `unvote` は `redirect` しない。呼び出し側が `onRoomFetch` で取り直す前提
- **`"use server"` のファイルからは非同期関数しか export できない**。クライアントと
  共有する定数は別のファイルに置く

- コメントには「なぜそうなっているか」を書く。コードを読めば分かることは書かない

## デプロイ設定

- `wrangler.jsonc` は実 ID と公開ホスト名ごと追跡している。設定を変えるときはこれを直す
- `wrangler.toml` の `database_id` は仮の値。こちらを手本にしない

## スキーマ変更

- `npm run drizzle:generate` で生成する。`drizzle/migrations/` の SQL とスナップショットは手で書かない
- `cf:deploy` が本番 D1 へのマイグレーションを先に流す。**消す変更は 2 回に分ける**（expand / contract）
