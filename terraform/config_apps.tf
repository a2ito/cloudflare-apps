locals {
  # Terraform で管理するアプリ。キーは Worker 名（= apps/<name> のディレクトリ名、Wrangler 設定の name）。
  #
  # - secrets: Worker の Secret の名前。値は var.secrets
  # - build_variables: Build variables の名前。値は var.build_variables（cf:config が wrangler.jsonc を組み立てるのに使う）
  # - build_token_uuid: ビルドがデプロイに使うトークン。ダッシュボードで作られたものが 2 種類ある
  # - build_caching_enabled: アプリごとにばらついている。揃えるのは別の変更で行う
  # - trigger_uuid: 取り込んだ既存のトリガー（imports.tf が使う）
  #
  # コード・D1・assets・平文の変数（vars）は wrangler の設定で持つ。Terraform は触らない。
  apps = {
    "account-book" = {
      secrets               = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]
      build_variables       = ["APP_HOSTNAME", "D1_DATABASE_ID"]
      build_token_uuid      = local.build_tokens.workers_builds_20260704
      build_caching_enabled = false
      trigger_uuid          = "055d9483-85f7-4da4-8a06-4e616ec974a7"
    }
    "dev-toolbox" = {
      secrets               = []
      build_variables       = ["APP_HOSTNAME"]
      build_token_uuid      = local.build_tokens.workers_builds_20260704
      build_caching_enabled = false
      trigger_uuid          = "ec3367cd-31ef-4a31-b260-400532e66b17"
    }
    "exam-lab" = {
      # Auth.js に移す途中。GOOGLE_CLIENT_ID は今のコード（ID トークン方式）が使っているので、
      # Auth.js 版がデプロイされるまで残す
      secrets               = concat(["GOOGLE_CLIENT_ID"], local.google_login_secrets)
      build_variables       = ["APP_HOSTNAME"]
      build_token_uuid      = local.build_tokens.cloudflare_apps
      build_caching_enabled = false
      trigger_uuid          = "ba910802-7cb2-4d5a-b18c-aa1b1ce0e4c3"
    }
    "games" = {
      secrets               = []
      build_variables       = []
      build_token_uuid      = local.build_tokens.cloudflare_apps
      build_caching_enabled = true
      trigger_uuid          = "19414edd-21ee-41ce-8d08-75cb0042eef1"
    }
    "kcalog" = {
      secrets               = local.google_login_secrets
      build_variables       = ["APP_HOSTNAME", "D1_DATABASE_ID"]
      build_token_uuid      = local.build_tokens.cloudflare_apps
      build_caching_enabled = true
      trigger_uuid          = "7a581eb6-3106-4394-9250-89c92c33284d"
    }
    "lifelog" = {
      secrets               = local.google_login_secrets
      build_variables       = ["APP_HOSTNAME", "D1_DATABASE_ID"]
      build_token_uuid      = local.build_tokens.cloudflare_apps
      build_caching_enabled = true
      trigger_uuid          = "b3b92fac-3875-442f-9ad2-2afa842c2d36"
    }
    "liftlog" = {
      secrets               = local.google_login_secrets
      build_variables       = ["APP_HOSTNAME", "D1_DATABASE_ID"]
      build_token_uuid      = local.build_tokens.cloudflare_apps
      build_caching_enabled = true
      trigger_uuid          = "c0fe05e8-450f-4d60-84b8-53d514df336c"
    }
    "number-logic" = {
      secrets               = []
      build_variables       = ["APP_HOSTNAME"]
      build_token_uuid      = local.build_tokens.workers_builds_20260704
      build_caching_enabled = false
      trigger_uuid          = "ea99bbbb-1856-484b-a047-61ce65873924"
    }
    "planning-porker" = {
      secrets               = []
      build_variables       = ["APP_HOSTNAME", "D1_DATABASE_ID"]
      build_token_uuid      = local.build_tokens.workers_builds_20260704
      build_caching_enabled = false
      trigger_uuid          = "d0b6941d-f4bd-4df2-8d49-f31b88ff64e4"
    }
    "price-tracker" = {
      secrets               = local.google_login_secrets
      build_variables       = ["APP_HOSTNAME", "D1_DATABASE_ID", "NEXT_PUBLIC_IMAGES_BASE_URL"]
      build_token_uuid      = local.build_tokens.workers_builds_20260704
      build_caching_enabled = false
      trigger_uuid          = "629e0ed6-e5e5-426c-bb7d-2f30b36bdf21"
    }
    "sakelog" = {
      secrets               = local.google_login_secrets
      build_variables       = ["APP_HOSTNAME", "D1_DATABASE_ID", "NEXT_PUBLIC_PHOTOS_BASE_URL"]
      build_token_uuid      = local.build_tokens.cloudflare_apps
      build_caching_enabled = false
      trigger_uuid          = "5edf5d60-1198-4191-8ded-b70d2eef0b6b"
    }
    "tabilog" = {
      secrets               = local.google_login_secrets
      build_variables       = ["APP_HOSTNAME", "D1_DATABASE_ID", "NEXT_PUBLIC_PHOTOS_BASE_URL"]
      build_token_uuid      = local.build_tokens.workers_builds_20260704
      build_caching_enabled = false
      trigger_uuid          = "903b588a-39ae-4906-b77f-1ab6fc9c7f76"
    }
    "warikan" = {
      secrets               = []
      build_variables       = ["APP_HOSTNAME", "D1_DATABASE_ID"]
      build_token_uuid      = local.build_tokens.workers_builds_20260704
      build_caching_enabled = false
      trigger_uuid          = "a185469d-85f8-472a-ad89-f5c5dccda63d"
    }
    "wordle" = {
      secrets               = []
      build_variables       = ["APP_HOSTNAME"]
      build_token_uuid      = local.build_tokens.workers_builds_20260704
      build_caching_enabled = false
      trigger_uuid          = "bb62f926-fd54-4fc9-9339-559417d1fc73"
    }
  }

  # Google ログインのアプリ（apps/kcalog を雛形にしたもの）が持つ Secret。
  # 中身は各アプリの wrangler.jsonc.example の末尾のコメントを参照。
  google_login_secrets = ["ALLOWED_EMAILS", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "AUTH_SECRET"]

  # Workers Builds のビルドトークン（ダッシュボードの Settings > Builds > API token）。
  build_tokens = {
    cloudflare_apps         = "791de442-6f22-43db-b26e-9fecef98af37" # cloudflare-apps build token
    workers_builds_20260704 = "2db53fd3-99bf-4a04-b720-80f1fb607f31" # Workers Builds - 2026-07-04 22:39
  }

  # 全アプリで同じ Workers Builds の設定。ルートの README の「デプロイ」の表と揃える。
  builds = {
    # GitHub の a2ito/cloudflare-apps への接続（Cloudflare の GitHub App）
    repo_connection_uuid = "a15901b6-8d2a-422b-9354-11736a567e45"
    build_command        = "npm run cf:build"
    # D1 のマイグレーションは cf:deploy の中で流す。アプリごとに変えない（ルートの README の「スキーマ変更」）
    deploy_command = "npm run cf:deploy"
    # non-production branch builds は作らない（PR の検証は GitHub Actions が行う）
    branch_includes = ["main"]
  }
}
