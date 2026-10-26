# CLAUDE.md

エンジニア向けの小さな道具をまとめたアプリ「dev-toolbox」。Next.js 16 (App Router) を
Cloudflare Workers で動かす。DB と認証は無い。
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
npm run lint && npm run build
```

## コードの約束

- **道具はブラウザの中で完結させる**。`src/components/tools/` は全て `"use client"` で、
  入力をサーバーへ送らない。パスワードや JWT、鍵を貼る道具なので、送らないことが前提になっている
- **サーバーから外へ取りに行くのは OGP チェッカー（`/api/ogp-check`）だけ**。利用者が入れた URL を
  取りに行くときは、必ず `src/lib/outbound-url.ts` の `checkOutboundUrl` を通す。
  リダイレクトも自動で追わず、行き先を 1 回ずつ確かめる。localhost やメタデータのアドレスを
  狙った入力（SSRF）を防ぐため
- **乱数は `crypto.getRandomValues` を使う**（`src/lib/password.ts`）。`Math.random` は予測できる。
  範囲に落とすときは剰余バイアスを避けて引き直す
- **道具を足すときは 3 か所そろえる**。`src/config/tools.ts` の `ToolSlug` と `tools`、
  `src/i18n/messages/ja.ts` と `en.ts`、`src/app/[lang]/tools/<slug>/`。
  メッセージは `satisfies Record<ToolSlug, …>` なので、訳が欠けると型で落ちる
- **画面の文言は直書きせず i18n のメッセージに置く**。言語は `/ja`・`/en` の 2 つで、
  既定は `ja`（`src/i18n/config.ts`）

- コメントには「なぜそうなっているか」を書く。コードを読めば分かることは書かない

## デプロイ設定

- `wrangler.jsonc` はコミットしてある。設定を変えるときはここを直す
- バインディングを足したら `npm run cf-typegen` で `cloudflare-env.d.ts` を作り直してコミットする
