# CLAUDE.md

数独ベースのロジックパズル「number-logic」。Next.js 16 (App Router) を Cloudflare Workers で動かし、
ブラウザの中だけで遊ぶ。DB と認証は無く、記録は localStorage に置く。
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
npm run lint && npm run format && npm run build
```

テストと typecheck の script は無い。型の誤りは `npm run build` で落ちる。

## コードの約束

- **問題は必ず唯一解にする**。`GameClient.tsx` の `generatePuzzleUnique` は、1 マス消すたびに
  `countSolutions` で解の数を数え、1 つでなくなる消し方は戻す。この検査を外さない
- **正誤は生成した解答と突き合わせて決める**。赤字表示もクリア判定も `solution` との一致を見る。
  唯一解が前提なので、解答と違う数字はすべて誤りとしてよい
- **ハイスコアは秒数で、小さいほど良い**。難易度ごとに `number-logic-highscore` に JSON で
  持つ（`src/lib/highscore.ts`）。キーや形を変えると保存済みの記録が読めなくなる
- 問題の生成は `useEffect` の中でする。`Math.random` を使うので、描画中に作ると
  サーバーとクライアントで盤面が食い違う
- `useSearchParams` を使う `GameClient` は `game/page.tsx` の `<Suspense>` の内側に置く。
  外すと Next.js のビルドが落ちる
- ダークモードは `<html>` の `dark` クラスで切り替える（`src/hooks/useTheme.ts`、
  キーは `number-logic:theme`）。`dark:` の定義は `globals.css` の `@custom-variant` にある
- README の「`@cloudflare/next-on-pages` でデプロイ」は古い。実際は OpenNext
  （`cf:build` / `cf:deploy`）で、`wrangler.jsonc` はコミットされている

- コメントには「なぜそうなっているか」を書く。コードを読めば分かることは書かない
