terraform {
  required_version = ">= 1.10"

  required_providers {
    cloudflare = {
      # 公式の cloudflare/cloudflare ではない。Workers Builds のトリガーと、コードを管理しない
      # Worker（Secret だけを持つ）を扱えるのがこの provider だけのため。
      source  = "a2ito/cloudflare"
      version = "~> 0.2"
    }
  }
}

# トークンは make が ~/.secrets から環境変数で渡す（Makefile を参照）。
# - CLOUDFLARE_API_TOKEN: Worker の Secret（アカウントのトークン cloudflare-apps-terraform）
# - CLOUDFLARE_BUILDS_API_TOKEN: Workers Builds の設定。Builds の API はアカウントのトークンを
#   受け付けないため、ユーザーのトークン（cloudflare-apps-terraform-builds）を別に渡す
# どちらも cloud-management の cloudflare/bootstrap が作る。
provider "cloudflare" {}
