# terraform

各アプリの Worker の定義を Terraform で管理する。コードのデプロイは今までどおり
Workers Builds（main への push → `npm run cf:deploy`）が行い、Terraform は触らない。

| 対象 | 管理する場所 |
| --- | --- |
| Worker の Secret（`AUTH_SECRET` など） | **Terraform**（`cloudflare_workers_script`） |
| Workers Builds の設定（Build command・Deploy command・Root directory・watch paths・Build variables） | **Terraform**（`cloudflare_workers_build_trigger`） |
| コード・D1・assets・平文の変数（`vars`）・互換性設定・カスタムドメイン | `apps/<name>/wrangler.jsonc.example`（デプロイのたびに wrangler が反映する） |
| D1 データベースの作成、Google OAuth の設定、GitHub との接続、ビルドトークン | ダッシュボード・`wrangler`（手作業） |

provider は公式の `cloudflare/cloudflare` ではなく
[`a2ito/cloudflare`](https://registry.terraform.io/providers/a2ito/cloudflare)。
Workers Builds のトリガーと、コードに触らずに Secret だけを持つ Worker を扱えるのがこれだけのため。

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

```sh
cd terraform
cp terraform.tfvars.example terraform.tfvars   # 初回のみ。値を埋める
make plan
make apply   # plan で保存したものだけを適用する
```

## アプリを足す

1. `config_apps.tf` の `apps` に足す（`trigger_uuid` は要らない）
2. `terraform.tfvars` に Secret と Build variables の値を足す
3. `make plan` → `make apply`。Worker が無ければ仮のスクリプトで作られ、トリガーが付く
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
- `wrangler.jsonc` に `vars` を足す・`compatibility_date` を変えるといった変更は、これまでどおりアプリの
  `wrangler.jsonc.example` で行う。Terraform には書けない（書くと plan で止まる）
