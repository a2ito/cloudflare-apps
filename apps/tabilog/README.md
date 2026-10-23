# たびログ (tabilog)

旅先で「何を食べた / 何を買った」「いくらだったか」「美味しかったか」を記録し、
スレッド形式のコメントでみんなで振り返る、旅行メモアプリです。

公開 URL: https://tabilog.a2ito.work （許可された Google アカウントのみログイン可）

## できること

- **旅行** … 期間・現地通貨・円換算レートを設定
- **記録** … 種別（食べた / 買った / 見た / その他）、場所、Google マップの URL（任意）、金額、★評価、感想、写真（複数枚・拡大とダウンロード）
- **集計** … 旅行ごとの合計金額を現地通貨と円で表示。種別・評価での絞り込み
- **コメント** … 記録ごとにスレッド形式（1 階層の返信）。誰がいつ書いたかを常に表示

## インストール（PWA）

ブラウザの「ホーム画面に追加」「アプリをインストール」から、単独のアプリとして
起動できる。iOS Safari は共有メニューの「ホーム画面に追加」から。

Service Worker は静的アセットとオフライン案内ページだけをキャッシュする。
記録やコメントは他の人の投稿で変わるうえ、ログインした本人にしか見せられないため、
HTML と API はキャッシュしない。

アイコンは `node scripts/gen-icons.mjs` で生成する（画像ライブラリには依存しない）。

## 技術構成

| 領域           | 採用技術                                                 |
| -------------- | -------------------------------------------------------- |
| フレームワーク | Next.js 16 (App Router / Server Actions)                 |
| 実行環境       | Cloudflare Workers (OpenNext)                            |
| DB             | Cloudflare D1 + Drizzle ORM                              |
| 写真           | Cloudflare R2                                            |
| 認証           | Auth.js (next-auth v5) + Google OAuth + 許可メールリスト |
| UI             | Tailwind CSS v4                                          |
| テスト         | Vitest + Miniflare（本物の D1 / R2 を起動して検証）      |

## 設計メモ

- **金額は最小通貨単位の整数で保存する**（`amount_minor`）。浮動小数の誤差を持ち込まないため。
  通貨ごとの小数桁数は `src/lib/money.ts` が持つ。
- **記録ごとに支払った通貨を持つ**（`amount_currency`）。旅先の買い物でも航空券や宿は
  日本円で先に払うことがあるため、入力時に現地通貨と日本円を選べる。円で入れた記録は
  円のまま保存するので、あとから旅行の換算レートを直しても金額がずれない。
  合計はいったん円に寄せてから現地通貨に戻して表示する。
- **日時は 2 種類に分けている**。記録の日時 `happened_at` は「現地の壁時計時刻」
  （`2026-03-01T12:30`）としてタイムゾーン変換をせず保持し、`created_at` / `updated_at` は
  監査用の UTC。旅先では「現地で何時か」が意味を持つため。
- **コメントは 2 階層まで**表示する。孫以降の返信は直近のトップレベルスレッドに畳む
  （深い入れ子はスマホで読みにくいため）。`src/lib/comments.ts` を参照。
- **記録の種別は `src/lib/entry-kinds.ts` に 1 か所だけ持つ**。保存する値・フォームの
  選択肢・一覧の絞り込みで同じ並びを使うため。種別を増やすときはここだけ直す。
  保存済みの記録に知らない種別が残っていても行が空にならないよう、表示はそのまま出す。
- **地図の URL は Google マップのものだけ受ける**（`src/lib/map-url.ts`）。貼られた文字列を
  そのままリンクにすると `javascript:` を踏ませられたり、地図のふりをした別サイトへ
  飛ばせたりするため、https と Google マップのホストで絞ってから保存する。
- **写真の実体は R2**、DB にはキーのみ。外部キーの cascade では R2 は消えないので、
  削除時はアクション側でキーを集めてから消す。
- **`wrangler.jsonc` は追跡していない**（実 ID と公開ホスト名を含むため）。
  雛形 `wrangler.jsonc.example` から `npm run cf:config` で生成する。

## セットアップ

このアプリはモノレポ [cloudflare-apps](../../README.md) の一部。**依存はリポジトリ
直下でまとめて入れる**（lockfile はルートに 1 つしかないため、このディレクトリで
`npm ci` は通らない）。

```bash
# リポジトリ直下で
npm ci

# 以降はこのディレクトリで

# 環境変数
cp .dev.vars.example .dev.vars
# AUTH_SECRET は openssl rand -base64 32 で生成
# AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET は Google Cloud Console で発行
# ALLOWED_EMAILS にログインを許可するメールアドレスをカンマ区切りで記入

# wrangler.jsonc を生成（D1 の ID と公開ホスト名を渡す）
D1_DATABASE_ID=<your-d1-id> APP_HOSTNAME=tabilog.example.com npm run cf:config

# ローカル D1 にマイグレーションを適用
npm run db:migrate:local

npm run dev
```

Google OAuth の承認済みリダイレクト URI には以下を登録します。

- `http://localhost:3000/api/auth/callback/google`（ローカル）
- `https://<公開ホスト名>/api/auth/callback/google`（本番）

## よく使うコマンド

| コマンド                               | 用途                                        |
| -------------------------------------- | ------------------------------------------- |
| `npm run dev`                          | 開発サーバ                                  |
| `npm test`                             | テスト（Miniflare で D1 / R2 を起動）       |
| `npm run lint` / `npm run typecheck`   | 静的チェック                                |
| `npm run db:generate`                  | スキーマ変更からマイグレーション SQL を生成 |
| `npm run db:migrate:local` / `:remote` | マイグレーション適用                        |
| `npm run preview`                      | Workers ランタイムでローカル確認            |
| `npm run cf:deploy`                    | Cloudflare へデプロイ                       |

## CI / CD

Pull Request を作ると GitHub Actions で lint・型チェック・テスト・ビルドが走る。

自分が出した PR には自動マージが予約され、検証（`quality` と `build`）が通りしだい
squash でマージされる。main は保護しており、この 2 つのチェックを通らないと
マージできない。

fork からの PR と、リポジトリ所有者以外が出した PR は対象外にしている。外部の変更が
人の目を通さず本番へ出るのを防ぐため。下書きの PR も対象外なので、まだ入れたくない
ものは Draft にしておく。

## デプロイ

main への push を Cloudflare の [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
が検知し、ビルドしてデプロイする。GitHub 側にデプロイ用の認証情報は置かない。
設定は Cloudflare ダッシュボードの **Settings > Build** で行う。

| 項目            | 値                                                              |
| --------------- | --------------------------------------------------------------- |
| Build command   | `npm run cf:build`                                              |
| Deploy command  | `npm run cf:deploy`                                             |
| Git branch      | `main`                                                          |
| Build variables | `D1_DATABASE_ID`, `APP_HOSTNAME`, `NEXT_PUBLIC_PHOTOS_BASE_URL` |

`wrangler.jsonc` は追跡していないため、`npm run cf:config` が雛形のプレースホルダを
これらの変数で埋めて生成する。手元に `wrangler.jsonc` がある場合は上書きしない。

### スキーマ変更の進め方

マイグレーションは `npm run cf:deploy` の中でデプロイより先に適用されるので、手で流す必要はない。
`&&` で繋いでいるため、適用に失敗したらデプロイも行われず、古いコードが動き続ける。

ただし**適用からデプロイ完了までの数分間は「新しいスキーマ + 古いコード」が同時に
存在する**。この間に本番が壊れないよう、カラムやテーブルを消す変更は 2 回に分けて出す
（expand / contract）。

1. **expand**: 追加だけを行う PR。新しいカラム・テーブルを足し、コードは新旧どちらの
   形でも動くようにする。古いカラムはまだ残す
2. **contract**: 古いカラムを参照しなくなったことを確認してから、`DROP COLUMN` などを
   含む PR を出す

1 つの PR で「追加して古いものを落とす」をやると、順序をどう入れ替えても壊れる瞬間ができる。

### 手元からデプロイする場合

```bash
# 初回のみ: リソース作成
npx wrangler d1 create tabilog-db
npx wrangler r2 bucket create tabilog-photos

# 初回のみ: シークレット登録
npx wrangler secret put AUTH_SECRET
npx wrangler secret put AUTH_GOOGLE_ID
npx wrangler secret put AUTH_GOOGLE_SECRET
npx wrangler secret put ALLOWED_EMAILS

npm run cf:deploy   # マイグレーション適用も含む
```

## 写真の配信

写真は R2 のカスタムドメインから CDN が直に返す。Worker を経由しない。

Route Handler (`/api/photos`) 経由だと写真 1 枚につき Worker が 1 回起動し、その
すべてで Auth.js のセッション復号が走る。CDN から直に返せば Worker は起動しない。

**引き換えに、写真は URL を知っていれば認証なしで取得できる。** キーが UUID v4 で
推測できないことに依存している。バケットの一覧は公開されないため列挙もできない。
記録の中身は D1 にあり、今まで通り認証の内側にある。

配信の基底 URL は `NEXT_PUBLIC_PHOTOS_BASE_URL` で渡す。`photoUrl()` は `next build`
時に値が埋め込まれるため、変えたら再ビルドが要る。渡さないときは `/api/photos` へ
落ちる。手元では写真が Miniflare のローカル R2 に入りカスタムドメインから取れない
ため、この経路が必ず要る。
