# ダッシュボードで作った Worker とトリガーを取り込む。取り込み済みなら何もしないので、残しておく。
# 新しいアプリはここに足さなくてよい（Terraform が Worker とトリガーを作る）。
#
# Worker は /no-content を付けて取り込む。付けないとコードまで読み、plan にバンドルの差分が出る。
# Secret の値は Cloudflare から読めないため、取り込んだ直後の plan では Secret が「変更」になり、
# 最初の apply で terraform.tfvars の値を送り直す。
locals {
  imported_apps = toset([
    "account-book", "dev-toolbox", "exam-lab", "games", "kcalog", "lifelog", "liftlog",
    "number-logic", "planning-porker", "price-tracker", "sakelog", "tabilog", "warikan", "wordle",
  ])
}

import {
  for_each = local.imported_apps

  to = cloudflare_workers_script.app[each.key]
  id = "${var.account_id}/${each.key}/no-content"
}

import {
  for_each = local.imported_apps

  to = cloudflare_workers_build_trigger.app[each.key]
  id = "${var.account_id}/${each.key}/${local.apps[each.key].trigger_uuid}"
}
