# コードを管理しない Worker。Terraform が持つのは Secret だけで、コード・D1・assets・平文の変数は
# Workers Builds（npm run cf:deploy）がデプロイする。content を書かないと、provider がコードと
# 他のバインディングに触らないモードになる。
resource "cloudflare_workers_script" "app" {
  for_each = local.apps

  account_id  = var.account_id
  script_name = each.key

  # 空のマップは null にする（Secret の無い Worker を import したときの state と揃え、差分を出さない）
  secret_text_bindings = length(each.value.secrets) == 0 ? null : {
    for name in each.value.secrets : name => var.secrets[each.key][name]
  }

  lifecycle {
    # destroy すると本番の Worker ごと消える
    prevent_destroy = true

    precondition {
      # 文字列にそろえて比べる（空のときに tuple と set(string) の比較になり、型の違いで一致しなくなるため）
      condition     = join(",", sort(nonsensitive(keys(lookup(var.secrets, each.key, {}))))) == join(",", sort(each.value.secrets))
      error_message = "terraform.tfvars の secrets[\"${each.key}\"] には次の Secret をちょうど書いてください: ${join(", ", each.value.secrets)}"
    }
  }
}

resource "cloudflare_workers_build_trigger" "app" {
  for_each = local.apps

  account_id           = var.account_id
  script_name          = cloudflare_workers_script.app[each.key].script_name
  repo_connection_uuid = local.builds.repo_connection_uuid
  build_token_uuid     = each.value.build_token_uuid

  build_command   = local.builds.build_command
  deploy_command  = local.builds.deploy_command
  root_directory  = "apps/${each.key}"
  branch_includes = local.builds.branch_includes
  # 依存をまとめて更新したときも再デプロイされるよう package-lock.json を含める（ルートの README）
  path_includes         = ["apps/${each.key}/*", "package-lock.json"]
  build_caching_enabled = each.value.build_caching_enabled

  environment_variables = length(each.value.build_variables) == 0 ? null : {
    for name in each.value.build_variables : name => var.build_variables[each.key][name]
  }

  lifecycle {
    # 消すと main への push でデプロイされなくなる
    prevent_destroy = true

    precondition {
      # 変数名は秘匿値ではない。sensitive のままだと条件の結果も sensitive になり評価できない
      condition     = join(",", sort(nonsensitive(keys(lookup(var.build_variables, each.key, {}))))) == join(",", sort(each.value.build_variables))
      error_message = "terraform.tfvars の build_variables[\"${each.key}\"] には次の変数をちょうど書いてください: ${join(", ", each.value.build_variables)}"
    }
  }
}

# workers.dev のサブドメインとプレビュー URL を無効にする。公開 URL は Custom Domain だけにする。
# wrangler もデプロイのたびにこの設定を書き込む（routes があれば無効）ため、値は wrangler と揃えて false にする。
# true にすると、デプロイのたびに wrangler が無効へ戻し、plan に差分が出続ける
resource "cloudflare_workers_script_subdomain" "app" {
  provider = cloudflare-official
  for_each = local.apps

  account_id       = var.account_id
  script_name      = cloudflare_workers_script.app[each.key].script_name
  enabled          = false
  previews_enabled = false
}

# アプリの D1。入れ物だけを持ち、スキーマは各アプリの drizzle のマイグレーション（npm run cf:deploy）が持つ
resource "cloudflare_d1_database" "app" {
  provider = cloudflare-official
  for_each = local.d1_databases

  account_id = var.account_id
  name       = each.value

  # 省略すると「設定を消す」差分になるため、実態（無効）を明示する
  read_replication = {
    mode = "disabled"
  }

  lifecycle {
    # 本番データが入っている
    prevent_destroy = true

    # primary_location_hint は作成時にしか効かず、既存の DB では API が返さない。指定しても差分が出続ける
    ignore_changes = [primary_location_hint]

    precondition {
      condition     = contains(local.apps[each.key].build_variables, "D1_DATABASE_ID")
      error_message = "${each.key} の build_variables に D1_DATABASE_ID がありません。アプリが D1 を読めなくなります"
    }
  }
}

# アプリの R2。中身（画像）はアプリが書き込む
resource "cloudflare_r2_bucket" "app" {
  provider = cloudflare-official
  for_each = local.r2_buckets

  account_id = var.account_id
  name       = each.value.name
  location   = each.value.location
  # 省略すると、import 直後に default を書き込む差分が出る
  jurisdiction  = "default"
  storage_class = "Standard"

  lifecycle {
    # 中身のあるバケットを Terraform の都合で消さない
    prevent_destroy = true
  }
}

# 画像を CDN から直に配るためのカスタムドメイン。Worker を経由しないので、一覧を開くたびに画像の枚数ぶん
# Worker が起動するのを避けられる。引き換えに、画像は URL を知っていれば認証なしで取れる（キーは UUID）。
#
# **このリソースは import できない。** ダッシュボードで先に付けると Terraform で管理できなくなるため、必ずここで作る。
# ホスト名は Build variables の NEXT_PUBLIC_IMAGES_BASE_URL から取る。アプリに埋め込む URL と食い違わないようにするため
resource "cloudflare_r2_custom_domain" "app" {
  provider = cloudflare-official
  for_each = local.r2_buckets

  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.app[each.key].name
  domain      = trimsuffix(trimprefix(var.build_variables[each.key]["NEXT_PUBLIC_IMAGES_BASE_URL"], "https://"), "/")
  zone_id     = var.zone_id
  enabled     = true
  min_tls     = "1.2"

  lifecycle {
    precondition {
      condition     = var.zone_id != null && contains(local.apps[each.key].build_variables, "NEXT_PUBLIC_IMAGES_BASE_URL")
      error_message = "${each.key} の画像のカスタムドメインには、terraform.tfvars の zone_id と、build_variables の NEXT_PUBLIC_IMAGES_BASE_URL（https://<ホスト名>）が要ります"
    }
  }
}
