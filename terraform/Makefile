# Cloudflare のトークンは ~/.secrets から読み、terraform のプロセスにだけ渡す。
# ~/.secrets で CLOUDFLARE_API_TOKEN を export すると wrangler も同じ値を使ってしまうため、
# 保存時は用途の分かる名前にしてここで詰め替える。
#   CLOUDFLARE_APPS_TERRAFORM_TOKEN        アカウントのトークン（Worker の Secret）
#   CLOUDFLARE_APPS_TERRAFORM_BUILDS_TOKEN ユーザーのトークン（Workers Builds の設定）
SECRETS_FILE ?= $(HOME)/.secrets
TOKENS = CLOUDFLARE_API_TOKEN="$$(. $(SECRETS_FILE) 2>/dev/null; printf '%s' "$$CLOUDFLARE_APPS_TERRAFORM_TOKEN")" \
         CLOUDFLARE_BUILDS_API_TOKEN="$$(. $(SECRETS_FILE) 2>/dev/null; printf '%s' "$$CLOUDFLARE_APPS_TERRAFORM_BUILDS_TOKEN")"
PLAN_FILE = tfplan

.PHONY: check init fmt validate plan apply

check:
	@. $(SECRETS_FILE) 2>/dev/null; \
	  [ -n "$$CLOUDFLARE_APPS_TERRAFORM_TOKEN" ] || { echo "ERROR: $(SECRETS_FILE) に CLOUDFLARE_APPS_TERRAFORM_TOKEN がありません（README を参照）"; exit 1; }; \
	  [ -n "$$CLOUDFLARE_APPS_TERRAFORM_BUILDS_TOKEN" ] || { echo "ERROR: $(SECRETS_FILE) に CLOUDFLARE_APPS_TERRAFORM_BUILDS_TOKEN がありません（README を参照）"; exit 1; }
	@[ -f terraform.tfvars ] || { echo "ERROR: terraform.tfvars がありません。terraform.tfvars.example をコピーして値を埋めてください"; exit 1; }

init:
	terraform init -input=false

fmt:
	terraform fmt

validate: init
	terraform validate

plan: check init
	@$(TOKENS) terraform plan -input=false -out=$(PLAN_FILE)

# plan を見て確かめてから流す（保存した plan だけを適用する）
apply:
	@[ -f $(PLAN_FILE) ] || { echo "ERROR: 先に make plan を実行してください"; exit 1; }
	@$(TOKENS) terraform apply -input=false $(PLAN_FILE)
	@rm -f $(PLAN_FILE)
