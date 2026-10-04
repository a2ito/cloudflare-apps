# warikan

ログイン不要の割り勘アプリ（walica 相当）。旅行やイベントの立替を記録して、誰が誰にいくら払えばいいかを **最小回数** で自動精算します。

- **Stack**: Next.js (App Router) / OpenNext on Cloudflare Workers / Cloudflare D1 + Drizzle ORM / Tailwind CSS
- **本番ドメイン**: warikan.a2ito.work
- **多通貨対応**（JPY / USD / EUR / GBP / KRW / CNY / TWD / THB）。グループで複数の通貨を使え、精算通貨へ為替レートで換算して精算する。レートは自動取得

## 機能

- グループ作成（イベント名 + 精算通貨 + ほかに使う通貨、URL 共有）
- メンバー追加・削除
- 立替の記録・編集・削除（支払った人 / 通貨 / 金額 / 内容 / 割り勘対象の均等割り）
- 通貨の追加・削除と為替レート（グループ内で通貨ごとに 1 つ。変えると同じ通貨の立替がすべて換算し直される）
  - 通貨を追加すると最新のレートを自動取得する。「最新レートに更新」で取り直せる
  - 手入力で上書きもできる（カードや両替の実レートに合わせるとき）
- 合計金額・各メンバーの受取/支払残高
- 精算結果（最小回数の送金リスト）
- 最近のグループ（この端末で開いたグループをトップに並べる。localStorage に保存し、サーバには送らない）

## インストール（PWA）

ブラウザの「ホーム画面に追加」「アプリをインストール」から、単独のアプリとして
起動できる。iOS Safari は共有メニューの「ホーム画面に追加」から。
ホーム画面のアイコンからはトップが開くので、グループにはトップの「最近のグループ」から戻る。

Service Worker は静的アセットとオフライン案内ページだけをキャッシュする。
立替は他のメンバーの記録で変わり、古い精算結果を見せると払い間違いにつながるため、
HTML と Server Actions はキャッシュしない。

アイコンは `node scripts/gen-icons.mjs` で `src/app/icon.svg` に合わせた PNG を生成している。

## ローカル開発

このアプリはモノレポ [cloudflare-apps](../../README.md) の一部。**依存はリポジトリ
直下でまとめて入れる**（lockfile はルートに 1 つしかないため、このディレクトリで
`npm ci` は通らない）。

```bash
# リポジトリ直下で
npm ci
```

以降はこのディレクトリで作業する。`wrangler.jsonc` は追跡していないので、初回は雛形から作る
（本番の値でなくてよい。ローカル D1 は ID を見ない）。

```bash
D1_DATABASE_ID=local APP_HOSTNAME=localhost npm run cf:config

# ローカル D1 にマイグレーション適用（初回・スキーマ変更時）
npm run db:generate        # schema.ts からマイグレーション SQL 生成
npm run db:migrate:local   # ローカル D1 に適用

npm run dev                # http://localhost:3000
npm test                   # vitest（換算・レート取得のテスト）
```

`next dev` でも `initOpenNextCloudflareForDev()` によりローカル D1 バインディングが有効になります。

Workers ランタイムでの動作確認:

```bash
npm run preview   # opennextjs-cloudflare build && preview
```

## デプロイ（Cloudflare）

main への push を Cloudflare Workers Builds が検知し、ビルドしてデプロイする。
**通常のデプロイは手で流さない。** GitHub 側にデプロイ用の認証情報は置かない。

Workers Builds の設定は Cloudflare ダッシュボードの **Settings > Build** で行う。
モノレポなので **root directory にこのアプリのディレクトリを指す**。Worker 名は
Wrangler 設定の `name`（`warikan`）と一致していなければビルドが落ちる。

| 項目 | 値 |
| --- | --- |
| Root directory | `apps/warikan` |
| Build command | `npm run cf:build` |
| Deploy command | `npm run cf:deploy` |
| Git branch | `main` |
| Build watch paths | `apps/warikan/*`、`package-lock.json` |
| Build variables | `D1_DATABASE_ID`, `APP_HOSTNAME` |

`wrangler.jsonc` は実 ID と公開ホスト名を含むため追跡していない。`npm run cf:config` が
雛形 `wrangler.jsonc.example` のプレースホルダを Build variables の値で埋めて生成する。
手元に `wrangler.jsonc` がある場合は上書きしない。

マイグレーションは `npm run cf:deploy` の中でデプロイより先に適用されるので、手で流す必要はない。
`&&` で繋いでいるため、適用に失敗したらデプロイも行われず、古いコードが動き続ける。

### 本番 D1 を作り直すとき

```bash
npx wrangler d1 create warikan-db
```

出力された `database_id` を Build variables の `D1_DATABASE_ID` に設定し直す。

### カスタムドメイン

公開ホスト名は Build variables の `APP_HOSTNAME` で決まる。`wrangler.jsonc` の `routes` に
`custom_domain: true` で入るので、デプロイ時に Cloudflare がドメインを割り当てる
（`a2ito.work` ゾーンが Cloudflare 管理下にある前提）。

## 構成

| パス | 役割 |
| --- | --- |
| `src/db/schema.ts` | Drizzle スキーマ（groups / members / expenses / expense_participants / exchange_rates） |
| `src/lib/db.ts` | D1 バインディングから Drizzle クライアント取得 |
| `src/lib/currency.ts` | 通貨定義・最小単位(minor units)変換・整形 |
| `src/lib/exchange.ts` | 為替レートの検証と精算通貨への換算（BigInt で計算） |
| `src/lib/rate-api.ts` | 為替レートの自動取得（[fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api)、キー不要） |
| `src/lib/group-currencies.ts` | グループへの通貨登録とレートの取得・更新 |
| `src/lib/recent-groups.ts` | この端末で開いたグループの一覧（localStorage） |
| `src/lib/settlement.ts` | 均等割り + 最小送金の精算アルゴリズム（純粋関数） |
| `src/app/page.tsx` | トップ（グループ作成） |
| `src/app/g/[id]/` | グループ詳細ページ・Server Actions・クライアント UI |

金額は通貨の最小単位の整数で保持し、精算計算を整数で行うことで丸め誤差を回避しています。
外貨の立替は元の通貨のまま保存し、表示のたびにグループのレートで精算通貨へ換算します
（1 件ごとに四捨五入）。レートは自動で更新し続けず、通貨の追加時と「最新レートに更新」を
押したときだけ取得します。表示のたびに精算額が変わらないようにするためです。
