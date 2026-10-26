# CLAUDE.md

ログイン不要のブラウザゲーム集「games」。Next.js 16 (App Router) を Cloudflare Workers で動かし、
1 つの Worker に複数のゲームを載せて `/<name>` で出し分ける。DB と認証は無い。
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
npm run lint && npm run format && npm test && npm run build
```

## ゲームを足すとき

- **認証の要らないゲームはアプリを分けず、ここに `/<name>` として足す**
- `src/app/(<name>)/<name>/` に `layout.tsx`・`page.tsx`・`globals.css` を置く。
  `layout.tsx` の metadata に `PWA_METADATA` と `APPLE_TOUCH_ICON`（`src/lib/pwa.ts`）を混ぜ、
  `<ServiceWorkerRegistrar />` を入れる。どのゲームから追加しても同じ PWA になるようにするため
- components と lib は `src/games/<name>/`、説明は `src/games/<name>/README.md`、画像は `public/<name>/`
- 一覧に足す場所は 4 つ。`src/app/(portal)/page.tsx` の `GAMES`、`src/app/manifest.ts` の
  `shortcuts`、この README の表、ルート README のアプリ一覧の呼び名

## コードの約束

- **ゲームごとに root layout を分ける**。`globals.css` の中身がゲームごとに違い、
  まとめると互いに干渉する。トップページからのリンクが `<Link>` ではなく `<a>` なのもこのため
- **全ゲームで同じオリジンを共有する**。localStorage / sessionStorage のキーには
  `<name>:` を付けて `src/games/<name>/lib/storage-keys.ts` に置き、Cookie は `path` を
  ゲームのパスに絞る。読み書きは `src/lib/storage.ts` を使う（使えない環境でも落とさない）
- **認証や秘密を扱うものはここに入れない**。1 つの XSS が全ゲームに及ぶため
- **ゲームの規則は `src/games/<name>/lib/` の純粋関数に置く**。乱数は `rand` / `rng` を
  引数で受ける（既定は `Math.random`）。テストで種を固定して盤面を再現するため
- **`public/` の画像は URL ごとにキャッシュ優先で返す**（`public/sw.js`）。同じ URL のまま
  中身を差し替えると、一度開いた人には古いまま出る。ファイル名を変えるか `CACHE` の版を上げる
- Service Worker は画面をネットワーク優先にしている。本番でだけ登録し、開発中は消す
  （古い JS がキャッシュから返って編集が反映されなくなるため）

- コメントには「なぜそうなっているか」を書く。コードを読めば分かることは書かない

## テスト

- Vitest。設定ファイルは無く、既定どおり `*.test.ts` を拾う
- 今あるのは `src/app/robots.test.ts` と `src/games/hexspin/lib/game.test.ts`。
  規則のテストは種を固定した乱数（mulberry32）を `lib/` の関数に渡して書く
