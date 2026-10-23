# さけログ (sakelog)

飲んだお酒の「銘柄・造り手・値段・買った場所」と、軸ごとの評価・感想・写真を
1 本ずつ残していくメモアプリです。ワイン・ビール・日本酒・焼酎・ウイスキー・ジンを
同じ形で記録し、横断して見返せます。

公開 URL: https://sakelog.a2ito.work （許可された Google アカウントのみログイン可）

## できること

- **記録** … 種類、銘柄、造り手、分類、年、度数、材料、国・産地、価格、購入場所と店の URL、
  飲んだ日、感想、写真（複数枚・拡大とダウンロード）
- **種類ごとの項目** … 選んだ種類でだけ入力欄が出る
  （日本酒: 精米歩合・日本酒度・酸度 / ウイスキー: 熟成年数・樽 / ビール: IBU / 焼酎: 蒸留方法 /
  ワイン・ウイスキー: 年）
- **評価** … 総合 / 香り / 味 / 余韻 / コスパ の 5 軸をそれぞれ ★1〜5 で。付けなかった軸は表示しない
- **探す** … 種類のタブと、銘柄・造り手・産地・分類・購入場所・材料の横断検索。
  材料 / 総合評価での絞り込みと、飲んだ日・総合評価・価格の 3 通りの並べ替え
- **ガイド**（`/guide`） … 種類ごとの成り立ちと、品種・ホップ・酒米・ボタニカルの特性、
  数字（精米歩合・IBU など）の読み方
- **未開栓** … 飲んだ日を空欄にすると「まだ開けていない」として一覧の末尾に置く

旅行のような上位のまとまりは持たない。1 本 = 1 レコードで、見返すときは検索と絞り込みで辿る。

## インストール（PWA）

ブラウザの「ホーム画面に追加」「アプリをインストール」から、単独のアプリとして
起動できる。iOS Safari は共有メニューの「ホーム画面に追加」から。

Service Worker は静的アセットとオフライン案内ページだけをキャッシュする。
記録はログインした本人にしか見せられないため、HTML と API はキャッシュしない。

アイコンと `src/app/favicon.ico` は `node scripts/gen-icons.mjs` で生成する
（画像ライブラリには依存しない）。

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

- **種類をまたいで 1 つの表に持つ**（`drinks`）。共通する項目のほうが多く、一覧も横断で
  見たいため。種類でしか意味を持たない項目（精米歩合・IBU など）は null 許容の列として並べ、
  どの種類でどれを出すかは `src/lib/categories.ts` が決める。**その種類で意味を持たない値は
  保存時に捨てる**ので、種類を変えても前の値が残らない。
- **種類の定義は `src/lib/categories.ts` の 1 か所**。保存する値・フォームの入力欄・
  一覧のタブ・詳細の表示・ガイド画面をすべてここから組み立てる。材料と分類に付けた説明は
  入力欄の候補とガイドの両方で使う（解説を別に持つと、候補を足したときに片方だけ古くなる）。
- **材料は 1 つの表にまとめる**（`drink_ingredients`）。ブドウ品種・ホップ・酒米・ボタニカルは
  どれも「1 本に複数ある」「名前で絞り込みたい」という扱いが同じなので分けない。
  呼び方だけ種類ごとに変える。
- **価格は最小通貨単位の整数で保存する**（`price_minor`）。浮動小数の誤差を持ち込まないため。
  通貨ごとの小数桁数は `src/lib/money.ts` が持つ。国内で買うことが多いので既定は円だが、
  旅行先や輸入元の値段をそのまま残せるよう通貨も選べる。価格が空なら通貨も残さない。
- **評価の軸は `src/lib/ratings.ts` に 1 か所だけ持つ**。DB の列 `rating_<軸>`、フォームの
  入力欄、詳細画面の表示をすべてこの一覧から組み立てる。軸を足すときはここと
  `src/db/schema.ts` を直す。未評価は `null`（0 は「未評価」としてフォームから来る値）。
- **日付は 2 種類に分けている**。`drunk_at` は飲んだ日（`2026-09-23`）でタイムゾーン変換を
  せず保持し、`created_at` / `updated_at` は監査用の UTC。`drunk_at` が `null` は
  「まだ開けていない」を意味し、一覧では末尾に置く（日付の前後で並べようがないため）。
- **知らない種類や分類が残っていても画面を壊さない**。`categoryDef()` は未知の値を
  「その他」の定義で受け、分類と材料は自由入力も許す（候補はあくまで候補）。
- **店の URL は https のものだけ受ける**（`src/lib/shop-url.ts`）。買う先は実店舗とは限らず
  通販サイトも入るのでホストは絞らないが、貼られた文字列をそのままリンクにすると
  `javascript:` を踏ませられるため、形を検証してから保存する。表示されるホストと
  飛び先が食い違う `user:pass@` 付きの URL も弾く。
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
D1_DATABASE_ID=<your-d1-id> APP_HOSTNAME=sakelog.example.com npm run cf:config

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

## デプロイ

main への push を Cloudflare の [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
が検知し、ビルドしてデプロイする。GitHub 側にデプロイ用の認証情報は置かない。
設定は Cloudflare ダッシュボードの **Settings > Build** で行う。

| 項目            | 値                                                              |
| --------------- | --------------------------------------------------------------- |
| Root directory  | `apps/sakelog`                                                  |
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

### 手元からデプロイする場合

```bash
# 初回のみ: リソース作成
npx wrangler d1 create sakelog-db
npx wrangler r2 bucket create sakelog-photos

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
