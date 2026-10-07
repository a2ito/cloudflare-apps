variable "account_id" {
  description = "Worker を置く Cloudflare アカウントの ID"
  type        = string
  default     = "a87f4a10ba648f14c384e0496f347814"
}

# 値はコミットしない terraform.tfvars に書く（terraform.tfvars.example を参照）。
# 名前は config_apps.tf の secrets / build_variables と一致していなければならない。

variable "secrets" {
  description = "Worker の Secret の値。キーはアプリ名、値は Secret 名 => 値"
  type        = map(map(string))
  sensitive   = true
  default     = {}

  # 雛形の値のまま apply すると、その文字列が本番の Secret になる
  validation {
    condition     = nonsensitive(alltrue([for app in values(var.secrets) : alltrue([for v in values(app) : v != "" && !startswith(v, "FILL_ME")])]))
    error_message = "secrets に空の値か、雛形の値（FILL_ME...）が残っています。"
  }
}

variable "build_variables" {
  description = "Workers Builds の Build variables の値。キーはアプリ名、値は変数名 => 値。実 ID と公開ホスト名を含むためコミットしない"
  type        = map(map(string))
  default     = {}
}
