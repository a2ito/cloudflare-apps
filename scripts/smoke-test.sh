#!/usr/bin/env bash
# ビルド済みのアプリを wrangler dev（workerd）で起動し、/ を開いて 5xx にならないことを確かめる。
# CI の build job が cf:build の後に、アプリのディレクトリで実行する。
#
# ビルドは通るのに Worker が起動時に落ちる（全リクエストが Error 1101）壊れ方は、lint・型・
# テスト・ビルドでは見つからない。2026-10-12 に next 16.4.0 への更新（#85）で全アプリが
# これで落ちたため足した。
set -euo pipefail

PORT="${SMOKE_PORT:-8787}"
LOG="$(mktemp)"

# Secret は本番の値を使わない。起動と画面の表示に必要な名前だけ仮の値で埋める。
# 手元で実行したときに既存の .dev.vars を壊さないよう、無いときだけ作って最後に消す
created_dev_vars=false
if [ ! -f .dev.vars ]; then
  cat >.dev.vars <<'EOF'
AUTH_SECRET=smoke-test-secret-0123456789abcdef
AUTH_TRUST_HOST=true
AUTH_GOOGLE_ID=smoke-test
AUTH_GOOGLE_SECRET=smoke-test
ALLOWED_EMAILS=smoke-test@example.com
EOF
  created_dev_vars=true
fi

cleanup() {
  [ -n "${pid:-}" ] && kill "$pid" 2>/dev/null || true
  # npx を止めても workerd が残ることがあるので、ポートで探して止める
  pkill -f "workerd.*${PORT}" 2>/dev/null || true
  if [ "$created_dev_vars" = true ]; then rm -f .dev.vars; fi
  rm -f "$LOG"
}
trap cleanup EXIT

# D1 を使うアプリは、テーブルが無いとページの描画で落ちる。ローカルの D1 にスキーマを入れる
if npm pkg get scripts.db:migrate:local | grep -q wrangler; then
  npm run db:migrate:local >/dev/null
fi

npx wrangler dev --port "$PORT" >"$LOG" 2>&1 &
pid=$!
# 最後に止めたときの「Terminated」をログに出さない
disown "$pid"

for _ in $(seq 1 60); do
  grep -q "Ready on" "$LOG" && break
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "wrangler dev が起動前に終了しました"
    cat "$LOG"
    exit 1
  fi
  sleep 1
done
if ! grep -q "Ready on" "$LOG"; then
  echo "wrangler dev が 60 秒以内に起動しませんでした"
  cat "$LOG"
  exit 1
fi

# ログイン画面などへのリダイレクトも追い、最後に開いたページで判定する
code=$(curl -sL -o /dev/null -w '%{http_code}' --max-time 30 "http://localhost:${PORT}/")
if [ "$code" -ge 500 ] || [ "$code" = "000" ]; then
  echo "/ が ${code} を返しました"
  cat "$LOG"
  exit 1
fi
echo "/ -> ${code}"
