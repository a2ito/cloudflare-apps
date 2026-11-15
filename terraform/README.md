# terraform

各アプリの Worker の定義を Terraform で管理する。コードのデプロイは今までどおり
Workers Builds（main への push → `npm run cf:deploy`）が行い、Terraform は触らない。

| 対象                                                                                                                     | 管理する場所                                                               |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Worker の Secret（`AUTH_SECRET` など）                                                                                   | **Terraform**（`cloudflare_workers_script`）                               |
| Workers Builds の設定（Build command・Deploy command・Root directory・watch paths・Build variables）                     | **Terraform**（`cloudflare_workers_build_trigger`）                        |
| workers.dev のサブドメインとプレビュー URL（無効にする）                                                                 | **Terraform**（`cloudflare_workers_script_subdomain`、公式 provider）      |
| D1 データベース・R2 バケット・画像のカスタムドメイン（`config_apps.tf` の `d1_databases` / `r2_buckets` に載せたアプリ） | **Terraform**（公式 provider）                                             |
| コード・D1 の中身（マイグレーション）・assets・平文の変数（`vars`）・互換性設定・Worker のカスタムドメイン               | `apps/<name>/cloudflare.config.ts`（デプロイのたびに反映される）           |
| 上に載せていないアプリの D1 / R2                                                                                         | 手作業か cloud-management の `cloudflare/`                                 |
| 画像をキャッシュに乗せるルール（ゾーンに 1 つ）                                                                          | cloud-management の `cloudflare/`（`r2_buckets` に足したらホスト名を足す） |
| Google OAuth の設定、GitHub との接続、ビルドトークン                                                                     | ダッシュボード（手作業）                                                   |

provider は公式の `cloudflare/cloudflare` ではなく
[`a2ito/cloudflare`](https://registry.terraform.io/providers/a2ito/cloudflare)。
Workers Builds のトリガーと、コードに触らずに Secret だけを持つ Worker を扱えるのがこれだけのため。
自作の provider に無いリソース（workers.dev の設定）だけ、公式の provider を `cloudflare-official` として併用する。
リソースの種類名がどちらも `cloudflare_` で始まるため、公式のリソースには `provider = cloudflare-official` を書く。

## 前提

| もの                                                                                                                                                | 置き場所     | 作るところ                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------- |
| state のバケット `a2ito-cloudflare-apps-tfstate`                                                                                                    | GCS          | cloud-management の `gcp/bootstrap`           |
| `CLOUDFLARE_APPS_TERRAFORM_TOKEN`（アカウントのトークン、Workers Scripts Write・D1 Write・Workers R2 Storage Write、ゾーンの Zone Read・DNS Write） | `~/.secrets` | cloud-management の `cloudflare/bootstrap`    |
| `CLOUDFLARE_APPS_TERRAFORM_BUILDS_TOKEN`（**ユーザーの**トークン、Workers CI Write）                                                                | `~/.secrets` | 〃                                            |
| `terraform.tfvars`（Secret と Build variables の値）                                                                                                | 手元のみ     | `terraform.tfvars.example` をコピーして埋める |

トークンが 2 本あるのは、Workers Builds の API がアカウントのトークンを受け付けないため
（`12006: Invalid token` が返る）。

state のバケットは GCP のユーザー認証で読む（`gcloud auth application-default login`）。

## 使い方

手元から流す。CI（`ci.yml` の `terraform`）は整形と構文を見るだけで、plan / apply はしない。

```sh
cd terraform
cp terraform.tfvars.example terraform.tfvars   # 初回のみ。値を埋める
make plan
make apply   # plan で保存したものだけを適用する
```

## 注意

- Terraform の版は `.terraform-version` に揃える（手元は tfenv、CI の構文チェックも同じファイルを読む）。
  新しい版で state を書くと古い版で読めなくなる

## アプリを足す

1. `config_apps.tf` の `apps` に足す（`trigger_uuid` は要らない）
2. `terraform.tfvars` に Secret と Build variables の値を足す
3. `make plan` → `make apply`。Worker が無ければ仮のスクリプトで作られ、トリガーが付く
4. アプリの PR を `main` にマージすると Workers Builds が走る。**Terraform が作った Worker では、この最初のデプロイは失敗する**
5. 最新の `main` を手元に取り、手元から一度だけ上書きする（下の「最初のデプロイ」）。以降は `main` への push で普通にデプロイされる

### 最初のデプロイ

Terraform が作った Worker には仮のスクリプトが入っている。cf はこれを「script API で更新された Worker」とみなし、
CI（Workers Builds）では上書きせずに止まる（`Aborting the upload operation because of conflicts`）。
この確認は CI でだけ働くので、手元からなら上書きできる（`--force` は念のため）。
`vinext-cloudflare deploy` には `--force` を渡す口が無いため、Workers Builds の設定では避けられない。

1. 失敗した最初のビルドのログで、マイグレーションが当たったことを確かめる（`cf:deploy` に `db:migrate:remote` を
   含むアプリだけ。マイグレーションはデプロイより前に流れるので、デプロイが失敗しても当たっている）
2. 最新の `main` で、ビルドして上書きする。ビルドには `config_apps.tf` の `build_variables` に載せた変数を
   **すべて**渡す（`NEXT_PUBLIC_*` はビルド時に埋め込まれ、`cf:check-env` を持たないアプリもあるため、渡し忘れると
   仮の値のまま本番に出る）。`--prebuilt` はビルド結果を読むだけなので、deploy には変数は要らない

   ```sh
   cd apps/<アプリ>
   D1_DATABASE_ID=<ID> APP_HOSTNAME=<ホスト名> npm run cf:build   # build_variables をすべて
   CLOUDFLARE_API_TOKEN="$(. ~/.secrets; printf '%s' "$CLOUDFLARE_APPS_TERRAFORM_TOKEN")" npx cf deploy --prebuilt --force
   ```

   トークンは Terraform のアカウントトークン（Workers Scripts Write・Zone の DNS Write）で足りる。
   wifi-monitor ではこれで Custom Domain の付与まで通った。`npx cf auth login`（OAuth）でもよい

3. 手動ビルドで Workers Builds が通ることを確かめる（ルートの CLAUDE.md の「最初のデプロイの後」のビルドログの確認は、
   この成功したビルドで行う）。ダッシュボードの Settings > Builds のほか、API でも走らせられる

   ```sh
   # terraform/ で。state を読むので GCS の ADC 認証（gcloud auth application-default login）が要る
   terraform state show 'cloudflare_workers_build_trigger.app["<アプリ>"]'   # id がトリガーの UUID

   # <account_id> は terraform.tfvars の account_id。ビルド用のユーザートークンが要る
   curl -X POST "https://api.cloudflare.com/client/v4/accounts/<account_id>/builds/triggers/<trigger_uuid>/builds" \
     -H "Authorization: Bearer $(. ~/.secrets; printf '%s' "$CLOUDFLARE_APPS_TERRAFORM_BUILDS_TOKEN")" \
     -H "Content-Type: application/json" --data '{"branch":"main"}'
   ```

D1 と R2（画像）を Terraform で持たせるときは、`config_apps.tf` の `d1_databases` / `r2_buckets` にも足す。

- Terraform が D1 を作った場合、ID は apply のあとに `terraform state show 'cloudflare_d1_database.app["<アプリ>"]'` で調べ、
  Build variables の `D1_DATABASE_ID` に書いてもう一度 apply する。手で作った D1 は `imports.tf` で取り込む
- 画像のカスタムドメインは `NEXT_PUBLIC_IMAGES_BASE_URL` のホスト名で作られる。cloud-management の
  キャッシュルールにもホスト名を足す
- 公開したくない中身（レシートなど）のバケットは `public = false` にする。カスタムドメインを付けず、
  Worker が認証してから返す

Google OAuth の設定は、ルートの CLAUDE.md の「ダッシュボードで人がやること」のとおり手で行う。

## 気をつけること

- **R2 のカスタムドメインは import できない。** ダッシュボードで先に付けると Terraform で管理できなくなるので、
  必ず `r2_buckets` に足して Terraform で作る。ホスト名は Build variables の `NEXT_PUBLIC_IMAGES_BASE_URL` から取る

- **R2 のバケットは、マージより先に apply して作る。** デプロイは、無いバケットを自動で作って先に進む（wrangler の頃に起きた）。
  そのとき location は Terraform の指定どおりにならない（account-book では APAC のつもりが WNAM になった）。location は同じ名前で最初に作ったときのものが使われ、
  消して作り直しても変わらないので、直すには名前を変えるしかない。Terraform の plan にもこの差は出ない

- **Secret の値は state に平文で入る。** state のバケットは cloudflare-apps 専用にしている
- **Secret の値は Cloudflare から読めない。** Terraform の外（`wrangler secret put` やダッシュボード）で値を
  変えても差分にならない。Secret は Terraform からだけ変える
- **取り込んだ直後の最初の apply で、全 Secret を送り直す。** 値が読めず、state 上は空になっているため。
  `terraform.tfvars` の値が今の値と違うと、その値に変わる
- Secret を更新すると、Cloudflare は今のコードのまま新しいバージョンをデプロイする
- Worker とトリガーには `prevent_destroy` を付けている。destroy すると本番の Worker が消え、
  トリガーを消すと main への push でデプロイされなくなる
- **workers.dev はデプロイも書き込む。** デプロイのたびに `cloudflare.config.ts` の `workersDev` / `previewUrls` が反映される。
  Terraform は `cloudflare.config.ts` と同じ `false` にしている。`true` にすると、デプロイのたびに無効へ戻り plan に差分が出続ける
- 平文の変数を足す・`compatibilityDate` を変えるといった変更は、これまでどおりアプリの
  `cloudflare.config.ts` で行う。Terraform には書けない（書くと plan で止まる）
