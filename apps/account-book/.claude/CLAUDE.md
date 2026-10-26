# CLAUDE.md

家計簿アプリ「account-book」。Next.js 16 (App Router) を Cloudflare Workers で動かし、
DB は D1 + Drizzle ORM、認証は Google OAuth の自前実装（Auth.js は使っていない）。
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

# 以降はこのディレクトリで。typecheck の script は無いので tsc を直接呼ぶ
npm run lint && npx tsc --noEmit && npm test
```

## コードの約束

- **データは家族（グループ）単位**。支出・カテゴリ・タグ・サブスクを読む・書く・消すクエリは、
  必ず `groupId` を条件に入れる。ID だけで引くと、別のグループのデータを触れてしまう
- **API の入口は `src/lib/apiAuth.ts` の `authorize(request)`**。ログイン中のユーザと
  所属グループを解決し、失敗時は 401 / 403 の `response` を返す。認証なしの API を足さない
  （以前、集計 API が認証なしで全グループの合計を返していた）
- **セッション cookie は署名付き**（`src/lib/session.ts`）。中身を読むときは必ず
  `getSessionUser` を通す。cookie の値をそのまま ID として使わない
  - 署名の鍵は `GOOGLE_CLIENT_SECRET` から導出している。作り直すと全員ログアウトになる
- **Google ログインは `src/lib/oauth.ts` で検証する**。`state` の一致と、id_token の
  発行者・宛先・期限・`email_verified` を確かめてから、事前登録済みの `users` と突き合わせる
- 画面の保護は `src/middleware.ts`。新しいページを足したら `matcher` に入れる。
  入れ忘れると未ログインでも開ける
- **金額は円の整数**（`amount` は integer）。浮動小数で計算しない

- コメントには「なぜそうなっているか」を書く。コードを読めば分かることは書かない

## テスト

- Vitest。拾うのは `src/**/*.test.ts` のみ
- 計算や検証は純粋関数として `src/lib/` に切り出し、そこをテストする

## スキーマ変更

- スキーマは `src/db/schema.ts`。マイグレーションは `npm run drizzle:generate` で
  `drizzle/migrations/` に生成する。SQL とスナップショットは手で書かない
- `migrations.bk/` は Drizzle 移行前の古い SQL。もう適用しないので触らない
- `cf:deploy` が本番 D1 へのマイグレーションを先に流す。**消す変更は 2 回に分ける**（expand / contract）
