# state には Secret の値が平文で入る。バケットは cloudflare-apps 専用で、cloud-management の
# gcp/bootstrap が作る（他のスタックの CI から読めないよう、共用のバケットに相乗りしない）。
terraform {
  backend "gcs" {
    bucket = "a2ito-cloudflare-apps-tfstate"
    prefix = "terraform"
  }
}
