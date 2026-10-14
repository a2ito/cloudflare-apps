# spec-compare

同じカテゴリの商品（同じくらいのスペックのノート PC など）を、スペックと価格で並べて比べる個人用 Web アプリ。
[price-tracker](../price-tracker) が「同じ商品の店ごとの値段」を比べるのに対し、こちらは「別々の商品どうし」を比べる。

公開 URL: https://spec-compare.a2ito.work （許可された Google アカウントのみログイン可）

## できること

- **カテゴリ** … 比べるものの単位（ノート PC、モニターなど）。作るときにスペック項目のひな形を選べる
- **スペック項目** … カテゴリごとに決める比較表の列。値の型（数値 / あり・なし / テキスト）・単位・
  良し悪しの向き（大きいほど良い / 小さいほど良い / 比べない）を持つ。並び替え・名前の変更・削除ができる
- **商品** … 名前・メーカー・画像・メモと、カテゴリのスペック項目の値。分からない項目は空欄でよい
- **価格** … 店舗ごとに何件でも記録でき、一番安い記録を比較に使う。記録ごとに「中古」の印を付けられる
- **比較表** … 商品を行、スペックを列に並べる。列の見出しで並べ替え、項目ごとに一番良い値に色を付ける。
  見出しの ← → で列を動かすと、並び順を保存する（カテゴリの設定画面の並び順と同じもの）。
  見出しの右端をドラッグすると列幅を変えられる（ダブルクリックで元に戻す）。商品の列も変えられる。列幅は端末（ブラウザ）ごとに覚える
  横にスクロールしても、左の列（既定は商品と最安値）は固定される。見出しのピンを押すとその列まで固定し、固定の右端のピンを押すと 1 つ戻す。どこまで固定するかも端末ごとに覚える
  価格の上限・数値の範囲・「あり」だけ・テキストの部分一致で絞り込める。
  最安値は新品の記録から選び、新品の記録が無い商品だけ中古から選ぶ（「中古」の印が付く）。
  「新品があっても中古の価格を最安値に含める」にすると新品と中古をまとめて比べる
  最安値の店名は、その価格を記録したお店のページへのリンクになる（記録にリンクがあるときだけ）
- **簡易フィルタ** … 設定画面で「簡易フィルタに出す」にした項目は、比較表の上にワンタップで絞り込むチップが出る。
  大きいほど良い数値は「〜以上」、小さいほど良い数値は「〜以下」、比べない数値はその値ちょうど、テキストは値ごと
  テキストと比べない数値は複数選べ、同じ項目の中は「どれか」、項目どうしは「かつ」で絞る（`?in_<id>=a&in_<id>=b`）。
  「以上」「以下」は 1 つだけ。選んだ条件はブラウザにカテゴリごとに覚え、次に条件なしで開くと戻る
- **非表示・削除** … 比較表の行から、商品を非表示（候補から外す。価格の記録は残る）にしたり削除したりできる。
  非表示の商品は「非表示の商品も表示」（`?hidden=1`）で見え、「表示に戻す」で戻せる
- **お気に入り** … 比較表の商品名の左や商品ページの ☆ で付け外しする（DB に保存）。「お気に入りだけ表示」（`?fav=1`）で絞り込める
- **コスパ** … 大きいほど良い数値項目を 1 つ選ぶと「メモリ 1GB あたりの価格」のような列が増え、それでも並べ替えられる。
  カテゴリの設定で「既定のコスパ」を決めておくと、比較表を開いたときから出る
- **商品ページ** … 項目ごとにカテゴリ内で何位かを出す

## 設計メモ

- **スペック項目はカテゴリが持つ**。同じカテゴリの商品が同じ項目を埋めるので、比較表の列が揃う。
  商品ごとに自由なキーを持たせると、「メモリ」と「RAM」のような表記ゆれで比べられなくなる
- **値は `spec_values` に 1 項目 1 行で持つ**。数値と「あり / なし」は `value_num`（あり = 1）、
  テキストは `value_text`。未入力の項目は行を作らないので、0 と未入力を区別できる
- **項目の値の型はあとから変えられない**。入力済みの値が新しい型で読めなくなるため。変えたいときは作り直す
- **登録後に商品のカテゴリは変えられない**。埋めたスペックが別カテゴリの項目と噛み合わないため
- **商品が残っているカテゴリは消せない**。商品ごと消すと画像や価格の記録まで一度に失うため
- **比較の計算は `src/lib/compare.ts` に閉じ込める**。絞り込み・並べ替え・最良値・順位・コスパを
  DB を触らない純粋な関数にしてテストしている
- **比較の条件は URL に載せる**（`?min_2=16&sort=cost&cost=2` など）。JS 無しのフォームで動き、
  ブラウザの戻るや共有で同じ表に戻れる
- **中古は価格の記録に付ける**。同じ機種の新品と中古を並べて持てるように、商品ではなく記録の属性にしている。
  比較表は既定で、新品の記録がある商品は新品だけから最安値を選ぶ（中古を足しても、それまでの比較が勝手に変わらないように）。
  新品がもう売っていない機種も並べられるよう、新品の記録が無い商品だけは中古から選ぶ。
  新品と中古をまとめて比べるかは `?used=1` で URL に載せる。商品ページの最安値も同じ選び方
- **コスパは「大きいほど良い数値」だけ**。「価格 ÷ 重量」のように小さいほど良い項目で割っても意味を持たない
- **データはログインした人で共有する**（price-tracker と同じ）。1 人で使う前提で、許可メールリストで入口を絞っている
- **画像は R2 のカスタムドメインから CDN が直に返す**。比較表が商品数ぶんの画像を並べるため、
  Worker を経由させない。代わりに画像は URL を知っていれば認証なしで取れる（キーは推測できない UUID）。
  考え方は price-tracker の README の「画像の配信」と同じ
- **列幅は端末ごと、並び順は DB に持つ**。列幅は画面の広さで合う値が変わるので localStorage に置き、
  どの端末でも同じでよい並び順は `spec_fields.position` に置く
- **Service Worker は本番だけ登録する**。開発中は `/_next/static/` のファイル名が変わらず、古い JS が返って画面が更新されなくなるため

## 技術構成

| 領域 | 採用技術 |
| --- | --- |
| フレームワーク | Next.js 16 (App Router) |
| 実行環境 | Cloudflare Workers (OpenNext) |
| DB | Cloudflare D1 + Drizzle ORM |
| 画像 | Cloudflare R2（カスタムドメインで公開配信。バケットとドメインは terraform/ が持つ） |
| 認証 | Auth.js (next-auth v5) + Google OAuth + 許可メールリスト |
| UI | Tailwind CSS v4 |
| テスト | Vitest + Miniflare（本物の D1 / R2 を起動して検証） |

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
D1_DATABASE_ID=<your-d1-id> APP_HOSTNAME=spec-compare.example.com npm run cf:config

# ローカル D1 にマイグレーションを適用
npm run db:migrate:local

npm run dev
```

手元では `NEXT_PUBLIC_IMAGES_BASE_URL` を渡さない。画像は Miniflare のローカル R2 に入り、
`/api/images` 経由で表示される。

Google OAuth の承認済みリダイレクト URI には以下を登録する。

- `http://localhost:3000/api/auth/callback/google`（ローカル）
- `https://<公開ホスト名>/api/auth/callback/google`（本番）

## よく使うコマンド

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | 開発サーバ |
| `npm test` | テスト（Miniflare で D1 / R2 を起動） |
| `npm run lint` / `npm run typecheck` | 静的チェック |
| `npm run db:generate` | スキーマ変更からマイグレーション SQL を生成 |
| `npm run db:migrate:local` / `:remote` | マイグレーション適用 |
| `npm run preview` | Workers ランタイムでローカル確認 |
| `npm run cf:deploy` | Cloudflare へデプロイ |

## デプロイ

main への push を Cloudflare の [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
が検知し、ビルドしてデプロイする。Workers Builds の設定と Worker の Secret は
[terraform/](../../terraform) で管理している。

| 項目 | 値 |
| --- | --- |
| Root directory | `apps/spec-compare` |
| Build command | `npm run cf:build` |
| Deploy command | `npm run cf:deploy` |
| Git branch | `main` |
| Build watch paths | `apps/spec-compare/*`、`package-lock.json` |
| Build variables | `D1_DATABASE_ID`, `APP_HOSTNAME`, `NEXT_PUBLIC_IMAGES_BASE_URL` |

`wrangler.jsonc` は実 ID と公開ホスト名を含むため追跡していない。`npm run cf:config` が
雛形 `wrangler.jsonc.example` のプレースホルダをこれらの変数で埋めて生成する。
手元に `wrangler.jsonc` がある場合は上書きしない。

`NEXT_PUBLIC_IMAGES_BASE_URL` は `next build` 時に埋め込まれる。変えたら再ビルドが要る。

マイグレーションは `npm run cf:deploy` の中でデプロイより先に適用される。適用からデプロイ完了までの数分間は
「新しいスキーマ + 古いコード」が同時に存在するため、カラムやテーブルを消す変更は
2 回に分けて出す（expand / contract）。

### 初回だけ手でやること

1. D1（`spec-compare-db`）と R2（`spec-compare-images`）は手で作り、[terraform/](../../terraform) に import した。
   画像のカスタムドメインは terraform/ が `NEXT_PUBLIC_IMAGES_BASE_URL` のホスト名で作る。
   **カスタムドメインはダッシュボードで付けない**（import できず、Terraform で管理できなくなる）
2. 画像をキャッシュに乗せるルールはゾーンに 1 つしか持てず cloud-management の `cloudflare/` が持つので、そちらにもホスト名を足す
3. Google OAuth の承認済みリダイレクト URI に本番の URI を足す
4. `terraform/terraform.tfvars` に Secret（`AUTH_SECRET` など 4 つ）・Build variables
   （`D1_DATABASE_ID`・`APP_HOSTNAME`・`NEXT_PUBLIC_IMAGES_BASE_URL`）・`zone_id` の値を書き、`terraform/` で `make plan` → `make apply`
5. main に push すると Workers Builds がビルドしてデプロイする。トリガーは apply より後の push にしか反応せず、
   apply しただけでは Worker は Terraform が入れた仮のスクリプトのまま。watch paths に当たる変更を
   main に入れて最初のビルドを起こす
