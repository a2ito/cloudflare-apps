# CLAUDE.md

毎日 1 問の英単語当てゲーム「wordle」。Next.js 16 (App Router) を Cloudflare Workers で動かす。
DB も認証も無く、遊んだ結果はブラウザの `localStorage` にだけ残す。
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

- **単語リストは `src/app/api/daily-word/route.ts` にだけ置く**。クライアントから import すると
  全単語がバンドルに載る。ただし当日の答えは API の応答で見えるので、秘密ではない
- **単語はすべて小文字の 5 文字**。入力は小文字に揃えて比べている
- **単語リストを足す・並べ替えると、その日の答えが変わる**。出題は日付の種から
  リストの添字を引くだけなので、長さが変われば別の単語になる。遊んでいる途中の人の答えもずれる
- **日付は UTC で決まる**。サーバの出題（Workers の `new Date()`）とクライアントの保存キー
  （`wordle-<toISOString の日付>`）がどちらも UTC でそろっている。片方だけ日本時間にすると食い違う
- 盤面の保存はゲームが終わったときだけ行う。保存の形（`SavedState`）を変えると、
  既存の保存データは検証なしで読み込まれるので、古い形も読めるようにする
- **対応言語以外の `/[lang]` は 404 にする**（`isLang` + `notFound()`）。200 で返すと
  `/phpinfo` などがあるように見え、スキャナを呼び込む。`dynamicParams = false` は
  Cache Components を有効にするとビルドが落ちるので使わない
- 画面の文言は `src/locales/<lang>/common.json` から読む。言語を足すときは
  `src/i18n/lang.ts` の `LANGS`・`generateStaticParams`・`alternates` もそろえる

- コメントには「なぜそうなっているか」を書く。コードを読めば分かることは書かない

## デプロイ設定

- `wrangler.jsonc` は公開ホスト名ごと追跡している。設定を変えるときはこれを直す
