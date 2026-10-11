# terraform

各アプリの Worker の定義を Terraform で管理する。コードのデプロイは今までどおり
Workers Builds（main への push → `npm run cf:deploy`）が行い、Terraform は触らない。

| 対象 | 管理する場所 |
| --- | --- |
| Worker の Secret（`AUTH_SECRET` など） | **Terraform**（`cloudflare_workers_script`） |
| Workers Builds の設定（Build command・Deploy command・Root directory・watch paths・Build variables） | **Terraform**（`cloudflare_workers_build_trigger`） |
| workers.dev のサブドメインとプレビュー URL（無効にする） | **Terraform**（`cloudflare_workers_script_subdomain`、公式 provider） |
| コード・D1・assets・平文の変数（`vars`）・互換性設定・カスタムドメイン | `apps/<name>/wrangler.jsonc.example`（デプロイのたびに wrangler が反映する） |
| D1 データベースの作成、Google OAuth の設定、GitHub との接続、ビルドトークン | ダッシュボード・`wrangler`（手作業） |

provider は公式の `cloudflare/cloudflare` ではなく
[`a2ito/cloudflare`](https://registry.terraform.io/providers/a2ito/cloudflare)。
Workers Builds のトリガーと、コードに触らずに Secret だけを持つ Worker を扱えるのがこれだけのため。
自作の provider に無いリソース（workers.dev の設定）だけ、公式の provider を `cloudflare-official` として併用する。
リソースの種類名がどちらも `cloudflare_` で始まるため、公式のリソースには `provider = cloudflare-official` を書く。

## 前提

| もの | 置き場所 | 作るところ |
| --- | --- | --- |
| state のバケット `a2ito-cloudflare-apps-tfstate` | GCS | cloud-management の `gcp/bootstrap` |
| `CLOUDFLARE_APPS_TERRAFORM_TOKEN`（アカウントのトークン、Workers Scripts Write） | `~/.secrets` | cloud-management の `cloudflare/bootstrap` |
| `CLOUDFLARE_APPS_TERRAFORM_BUILDS_TOKEN`（**ユーザーの**トークン、Workers CI Write） | `~/.secrets` | 〃 |
| `terraform.tfvars`（Secret と Build variables の値） | 手元のみ | `terraform.tfvars.example` をコピーして埋める |

トークンが 2 本あるのは、Workers Builds の API がアカウントのトークンを受け付けないため
（`12006: Invalid token` が返る）。

state のバケットは GCP のユーザー認証で読む（`gcloud auth application-default login`）。

## 使い方

ふだんは PR で変える。`terraform/` を変えた PR では CI（`ci.yml` の `terraform-plan`）が plan を回して
PR にコメントし、main にマージされると `terraform-apply.yml` が差分を apply する。
plan が落ちると `ci-result` も落ち、自動マージは止まる。

手元から流すこともできる（CI が落ちたときの調査など）。

```sh
cd terraform
cp terraform.tfvars.example terraform.tfvars   # 初回のみ。値を埋める
make plan
make apply   # plan で保存したものだけを適用する
```

## CI / CD

| 用途 | なりすます SA | 権限 |
| --- | --- | --- |
| PR の plan | `cloudflare-apps-plan` | state のバケットの読み取りだけ。`-lock=false` で回す |
| main への push の apply | `cloudflare-apps-apply` | state とロックの書き込み |

SA と WIF のプロバイダは cloud-management の `gcp/bootstrap`（`config_cloudflare_apps_ci.tf`）が持つ。
OIDC の `sub` を完全一致で絞っているので、PR から apply 用の SA にはなりすませない。
fork からの PR には GitHub が Secret と id-token を渡さないため、plan は回らない。

GitHub に登録するもの（Cloudflare のトークンは手元の `~/.secrets` と同じ値。再発行したら両方を更新する）:

| 種類 | 名前 | 値 |
| --- | --- | --- |
| Variable | `GCP_WORKLOAD_IDENTITY_PROVIDER` | `gcp/bootstrap` の出力 `cloudflare_apps_workload_identity_provider` |
| Variable | `GCP_PLAN_SERVICE_ACCOUNT` | 〃 `cloudflare_apps_plan_service_account_email` |
| Variable | `GCP_APPLY_SERVICE_ACCOUNT` | 〃 `cloudflare_apps_apply_service_account_email` |
| Secret | `TERRAFORM_TFVARS` | `terraform.tfvars` の中身 |
| Secret | `CLOUDFLARE_API_TOKEN` | `CLOUDFLARE_APPS_TERRAFORM_TOKEN` |
| Secret | `CLOUDFLARE_BUILDS_API_TOKEN` | `CLOUDFLARE_APPS_TERRAFORM_BUILDS_TOKEN` |

```sh
. ~/.secrets
printf '%s' "$CLOUDFLARE_APPS_TERRAFORM_TOKEN" | gh secret set CLOUDFLARE_API_TOKEN
printf '%s' "$CLOUDFLARE_APPS_TERRAFORM_BUILDS_TOKEN" | gh secret set CLOUDFLARE_BUILDS_API_TOKEN
gh secret set TERRAFORM_TFVARS < terraform/terraform.tfvars
```

- **`terraform.tfvars` を変えたら `TERRAFORM_TFVARS` も更新する。** 自動では同期されない。
  Secret の値を変えるだけの変更は PR にならないので、手元で `make apply` してから Secret を更新する
- **リポジトリは public。** plan は PR のコメントと Actions のログに出る。`secrets` と `build_variables` は
  `sensitive` にして伏せている。秘匿値を持つ変数を足すときは `sensitive = true` を付ける
- Terraform の版は `.terraform-version` に揃える（手元は tfenv、CI も同じファイルを読む）。
  新しい版で state を書くと古い版で読めなくなる
- apply が途中で落ちたら、原因を直して `terraform-apply.yml` を `workflow_dispatch` で main のまま再実行する

## アプリを足す

1. `config_apps.tf` の `apps` に足す（`trigger_uuid` は要らない）
2. `terraform.tfvars` に Secret と Build variables の値を足す
3. GitHub の Secret `TERRAFORM_TFVARS` を更新してから PR を出す。マージで apply され、
   Worker が無ければ仮のスクリプトで作られ、トリガーが付く
4. `main` に push すると Workers Builds が本物のコードをデプロイする

D1 データベースや Google OAuth の設定は、ルートの CLAUDE.md の「ダッシュボードで人がやること」のとおり手で行う。

## 気をつけること

- **Secret の値は state に平文で入る。** state のバケットは cloudflare-apps 専用にしている
- **Secret の値は Cloudflare から読めない。** Terraform の外（`wrangler secret put` やダッシュボード）で値を
  変えても差分にならない。Secret は Terraform からだけ変える
- **取り込んだ直後の最初の apply で、全 Secret を送り直す。** 値が読めず、state 上は空になっているため。
  `terraform.tfvars` の値が今の値と違うと、その値に変わる
- Secret を更新すると、Cloudflare は今のコードのまま新しいバージョンをデプロイする
- Worker とトリガーには `prevent_destroy` を付けている。destroy すると本番の Worker が消え、
  トリガーを消すと main への push でデプロイされなくなる
- **workers.dev は wrangler も書き込む。** デプロイのたびに wrangler が設定を反映する（`routes` があれば無効）。
  Terraform は wrangler と同じ `false` にしている。`true` にすると、デプロイのたびに無効へ戻り plan に差分が出続ける
- `wrangler.jsonc` に `vars` を足す・`compatibility_date` を変えるといった変更は、これまでどおりアプリの
  `wrangler.jsonc.example` で行う。Terraform には書けない（書くと plan で止まる）
