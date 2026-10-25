# CLAUDE.md

Cloudflare Workers で動く Next.js アプリ群のモノレポ。アプリは `apps/<name>/` にあり、
アプリ固有の約束は `apps/<name>/.claude/CLAUDE.md` や各 README に書いてある。

このファイルには、どのアプリを触るときにも守ってほしい約束だけを書く。

## どのアプリの話かを決める

- 依頼にアプリ名（`apps/<name>`）が無いときは、README の「アプリ一覧」の概要と呼び名から当てる。
  `apps/` を一から探さない
- 候補が 2 つ以上残るときは、作業に入る前にどちらかを聞く（例: 「値段の比較」は price-tracker と spec-compare の両方に当たる）
- 決まったら、まず `apps/<name>/.claude/CLAUDE.md` と `apps/<name>/README.md` を読む
- アプリを足したり呼び名が増えたりしたら、アプリ一覧の行も直す

## PR の出し方

- **ローカルのテストが通ったら、確認を取らずにコミット・push・PR 作成まで進める**
  - ここでいうテストは、型チェック・lint・テスト。画面を変えたときはローカルでの動作確認も含む
  - テストが落ちたとき、または確認を省いたときは PR を出さずに報告する
  - ラベルなど判断が割れるところは、PR 本文と報告に書いておく
- **下書き（Draft）にしない**。最初から Ready for review で作る
- Ready にすると auto-merge（`.github/workflows/auto-merge.yml`）が予約され、
  CI が通りしだい squash でマージされる。Draft のままだと auto-merge が動かず止まる
- 人の目を通したいものだけ、依頼されたときに Draft にする

## 新しいアプリを足すとき

- **認証の要らないゲームはアプリを分けない**。`apps/games` に `/<name>` として足す
- **近い既存アプリを雛形にする**。D1 + Google ログインなら `apps/kcalog`
- アプリに置くもの
  - `.claude/CLAUDE.md` と `README.md`。README にはデプロイ設定の表を載せる
    （直下の `CLAUDE.md` は Next.js が生成するため `.gitignore` で無視している）
  - `wrangler.jsonc.example` と `scripts/gen-wrangler-config.mjs`。実 ID と公開ホスト名を
    含む `wrangler.jsonc` はコミットせず、`cf:config` で Build variables から生成する
  - `dependencies` に `esbuild`（理由はルート README の「esbuild をアプリの依存に置いている理由」）
  - scripts の `cf:build` / `cf:deploy`。**D1 を使うなら `cf:deploy` に `db:migrate:remote` を含める**
- ルート README のアプリ一覧に行を足す

### Terraform に足すもの

Worker の Secret と Workers Builds の設定は `terraform/` で管理する（`terraform/README.md`）。

- `terraform/config_apps.tf` の `apps` に行を足す。Root directory・Build command・
  Deploy command（`npm run cf:deploy`）・watch paths は全アプリ共通で、`main.tf` が組み立てる
- Secret と Build variables の名前を `config_apps.tf` に書き、値は人に `terraform.tfvars` へ書いてもらう
- D1 や R2（画像）を Terraform で持たせるなら `config_apps.tf` の `d1_databases` / `r2_buckets` に足す。
  **R2 の画像のカスタムドメインはダッシュボードで付けない**（import できない）。キャッシュのルールは
  cloud-management が持つので、そちらにもホスト名を足す
- **`wrangler secret put` は使わない。** Terraform の外で変えた Secret は差分にならず、次の apply で戻る
- `make plan` までは自分で確かめてよいが、`make apply` は人が実行する

### ダッシュボードで人がやること

リポジトリに残らないので、コマンドや値を提示して手でやってもらう。

- `wrangler d1 create`、Google OAuth の承認済みリダイレクト URI の登録
- Worker 名は Wrangler 設定の `name` と一致させる

### 最初のデプロイの後

- ビルドログで、Deploy command が `npm run cf:deploy` になっていること、
  D1 を使うならマイグレーションが適用されたことを確かめる
- 本番でログインして、記録の作成まで通す。設定漏れはビルドが成功していても起きる
