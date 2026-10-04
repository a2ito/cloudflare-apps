# 最安値メモ (price-tracker)

商品ごとに店舗別の価格を記録し、容量あたりの単価で最安値を比較する個人用 Web アプリ。

- Next.js 16 (App Router) + [@opennextjs/cloudflare](https://opennext.js.org/cloudflare) → Cloudflare Workers
- D1 (Drizzle ORM) / R2（商品画像）
- Auth.js v5 + Google ログイン。`ALLOWED_EMAILS` に載せたアカウントだけ利用可

## 機能

- 商品の登録・編集・削除（メーカー・単位・画像・カテゴリ）
- 荷姿（容量・入数）の追加・編集・削除
- カテゴリの追加・変更・削除
- 荷姿ごとの価格記録（価格・個数・日付・リンク・写真・メモ）と、その編集・削除
- 単価（g / ml は 100 あたり、それ以外は 1 あたり）で荷姿ごとに最安値を自動判定して一覧表示
- カテゴリ絞り込み・商品名検索
- 配色の切り替え（ライト / ダーク / システム追従）。選択は端末に保存し、描画前に適用するのでリロード時もちらつかない
- 画像はブラウザ側で長辺 1200px に縮小してから R2 に保存

### 商品と荷姿

容量と入数は荷姿が持ち、1 つの商品の下に荷姿を複数ぶら下げる。350ml × 6 缶のようなパッケージは、
1 個あたり 350ml・入数 6 の荷姿として登録し、合計 2,100ml で単価を出す。

同じ製品で荷姿（1000ml と 3000ml など）が違うものは、1 つの商品にまとめたうえで、
**最安値は荷姿ごとに別々に判定する**。荷姿をまたいで比べると、まとめ買いの割安さで大容量が
常に勝ってしまい、同じ荷姿どうしの比較ができなくなるため。単位は荷姿どうしで単価を比べられるよう
商品が持つ。

以前は荷姿が違えば別の商品として登録していた（マイグレーション 0005 で「リステリン 1000ml」の
ように名前の末尾へ容量を付けて分けた）。0008 で荷姿を切り出し、名前が「元の名前 + 空白 + 容量 + 単位」
で終わり、元の名前と単位が同じ商品が 2 件以上あるものを、id の最も小さい商品へまとめた。
画像・メモ・メーカー・カテゴリはまとめ先のものが残る。

### 画像の配信

画像は R2 のカスタムドメインから CDN が直に返す。Worker を経由しない。

以前は Worker 上の Route Handler (`/api/images`) が認証を確かめてから R2 を読んでいた。
ただしトップページが商品数ぶんのサムネイルを並べるため、一覧を 1 回開くだけで商品数ぶんの
Worker が起動し、その全てで Auth.js のセッション復号が走っていた。

**引き換えに、画像は URL を知っていれば認証なしで取得できる。** キーが UUID v4 で推測できない
ことに依存している。バケットの一覧は公開されないため列挙もできない。商品名・価格・履歴は D1 に
あり、今まで通り認証の内側にある。

配信の基底 URL は `NEXT_PUBLIC_IMAGES_BASE_URL` で渡す。`imageUrl()` はクライアント
コンポーネントからも呼ぶため `NEXT_PUBLIC_` 付きで、`next build` 時に値が埋め込まれる。
実行時の環境変数では差し替わらないので、変えたら再ビルドが要る。

基底 URL が無いときは `/api/images` へ落ちる。`src/app/api/images/[...key]/route.ts` が
その経路で、手元では画像が Miniflare のローカル R2 に入りカスタムドメインから取れないため
必ず要る。本番でも基底 URL を渡し忘れたときは、CPU 削減が効かないだけで画像は出る。

**以前はここで例外を投げていた。** 渡し忘れに気づかず Worker 経由へ戻るのを避ける意図
だったが、このアプリは全ページが動的レンダリングのため `imageUrl()` はビルド時に呼ばれず、
ビルドは通ってしまう。結果として本番のトップページが 500 になった。落とすより遅い方がよい。

## CI / CD

Pull Request を作ると GitHub Actions で lint・型チェック・テスト・ビルドが走る。

自分が出した PR には自動マージが予約され、検証が通りしだい squash でマージされる。

fork からの PR と、リポジトリ所有者以外が出した PR は対象外にしている。外部の変更が
人の目を通さず本番へ出るのを防ぐため。あわせて、外部からの PR は検証の実行自体に
承認を必要とする設定にしている。

下書きの PR も対象外なので、まだ入れたくないものは Draft にしておく。

デプロイは Cloudflare の [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) が担う。
main への push を Cloudflare が検知し、ビルドしてデプロイする。GitHub 側にデプロイ用の
認証情報は置かない。

Workers Builds の設定は Cloudflare ダッシュボードの **Settings > Build** で行う。
モノレポなので **root directory にこのアプリのディレクトリを指す**。Worker 名は
そこに置かれた Wrangler 設定の `name` と一致していなければビルドが落ちる。

| 項目 | 値 |
| --- | --- |
| Root directory | `apps/price-tracker` |
| Build command | `npm run cf:build` |
| Deploy command | `npm run cf:deploy` |
| Git branch | `main` |
| Build watch paths | `apps/price-tracker/*`、`package-lock.json` |
| Build variables | `D1_DATABASE_ID`, `APP_HOSTNAME`, `NEXT_PUBLIC_IMAGES_BASE_URL` |

`wrangler.jsonc` は追跡していないため、`npm run cf:config` が雛形のプレースホルダを
これらの変数で埋めて生成する。手元に `wrangler.jsonc` がある場合は上書きしない。

`@emnapi/core` と `@emnapi/runtime` は直接使わないが、Tailwind の wasm パッケージが
要求する版が lock に記録されず `npm ci` が同期エラーになるため、明示的に依存へ加えている。

マイグレーションは `npm run cf:deploy` の中でデプロイより先に適用されるので、手で流す必要はない。
`&&` で繋いでいるため、適用に失敗したらデプロイも行われず、古いコードが動き続ける。

## セットアップ

依存はリポジトリ直下でまとめて入れる。lockfile はルートに 1 つしかないため、
このディレクトリで `npm ci` は通らない。

### 1. Google OAuth クライアントの作成

[Google Cloud Console](https://console.cloud.google.com/apis/credentials) で OAuth 2.0 クライアント ID（ウェブアプリケーション）を作成し、承認済みリダイレクト URI に以下を登録する。

- `http://localhost:3000/api/auth/callback/google`（ローカル開発）
- `https://<公開ホスト名>/api/auth/callback/google`（本番）

### 2. ローカル環境変数

```sh
cp wrangler.jsonc.example wrangler.jsonc   # __D1_DATABASE_ID__ と __APP_HOSTNAME__ を書き換える
cp .dev.vars.example .dev.vars
openssl rand -base64 32   # AUTH_SECRET に貼る
```

`.dev.vars` に `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` / `ALLOWED_EMAILS` を記入する。

### 3. ローカル DB のマイグレーション

```sh
npm run db:migrate:local
```

### 4. 開発サーバ

```sh
npm run dev        # next dev（bindings は miniflare 経由で利用可）
npm run preview    # Workers ランタイムで実行して確認
```

## テスト

```sh
npm test             # Vitest 一括実行
npm run test:watch
npm run typecheck    # next typegen + tsc
npm run lint
```

DB / R2 を使うテストは Miniflare（workerd）上の本物の D1 / R2 を起動し、`drizzle/` のマイグレーション SQL をそのまま適用する。
サーバーアクションは認証・Cloudflare コンテキスト・`revalidatePath` / `redirect` だけをモックして実行する。

## デプロイ

```sh
# 初回のみ: Secrets を登録（値はリポジトリに含めない）
npx wrangler secret put AUTH_SECRET          # openssl rand -base64 32 で生成
npx wrangler secret put AUTH_GOOGLE_ID
npx wrangler secret put AUTH_GOOGLE_SECRET
npx wrangler secret put ALLOWED_EMAILS       # 許可するメールをカンマ区切りで

npm run cf:build
npm run cf:deploy   # マイグレーション適用も含む
```

## スキーマ変更

`src/db/schema.ts` を編集して以下を実行する。

```sh
npm run db:generate          # drizzle/ に SQL を生成
npm run db:migrate:local
```

本番への適用は main へのマージ後、Workers Builds の `npm run cf:deploy` が行う。

## リソース

| 種別 | 名前 |
| --- | --- |
| Worker | `price-tracker` |
| D1 | `price-tracker-db` |
| R2 | `price-tracker-images`（カスタムドメインを生やして公開配信） |
| ビルド | Cloudflare Workers Builds |

ログインを許可するアカウントを増やすときは、`ALLOWED_EMAILS` の Secret を
カンマ区切りで登録し直してから再デプロイする。

```sh
npx wrangler secret put ALLOWED_EMAILS
npm run deploy
```
