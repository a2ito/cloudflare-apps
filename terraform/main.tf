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
      condition     = join(",", sort(keys(lookup(var.build_variables, each.key, {})))) == join(",", sort(each.value.build_variables))
      error_message = "terraform.tfvars の build_variables[\"${each.key}\"] には次の変数をちょうど書いてください: ${join(", ", each.value.build_variables)}"
    }
  }
}
