# wifi-monitor

端末で動くエージェントが計測した Wi-Fi の通信状況（受信強度・遅延・パケット損失・速度）を受け取って記録し、
グラフで振り返るアプリ。

公開 URL: https://wifi-monitor.a2ito.work （許可された Google アカウントのみログイン可）

## できること

- **端末の登録** … 端末名を入れるとトークンを発行する。トークンはその場で 1 回だけ表示する
- **端末一覧** … 端末ごとに、オンラインかどうか（最後の受信から 5 分以内か）と最新の計測値を並べる
- **グラフ** … 遅延・パケット損失・受信強度・リンク速度・ダウンロード速度を 24 時間 / 7 日で表示する。
  計測が途切れた時間帯は線を切る
- **端末の削除** … 計測の記録ごと消す

計測そのものは別のエージェント（Mac / Linux で常駐するもの）が行い、`POST /api/samples` に送る。

## 受信 API

```http
POST /api/samples
Authorization: Bearer wfm_...
Content-Type: application/json

{
  "samples": [
    {
      "measuredAt": "2026-11-15T12:00:00+09:00",
      "ssid": "home-5G",
      "rssi": -55,
      "noise": -92,
      "txRateMbps": 866,
      "latencyMs": 12.3,
      "packetLossPct": 0,
      "downloadMbps": null
    }
  ]
}
```

| 応答 | 意味                                                                              |
| ---- | --------------------------------------------------------------------------------- |
| 200  | `{ "accepted": n, "skipped": m }`。skipped は再送・古すぎる・未来すぎる計測の件数 |
| 400  | 本文が JSON でない、または形が違う。1 件でも壊れていれば全体を入れない            |
| 401  | トークンが無い・正しくない                                                        |
| 413  | 本文が 256 KiB を超えた                                                           |

形は `src/lib/sample-schema.ts`。`measuredAt` 以外は省略・`null` でよい。1 回に 300 件まで
（D1 のクエリ数の上限に収めるため。溜めた分は分けて送る）。トークンが正しくなければ本文を読まずに 401 を返す。

## 設計メモ

- **エージェントはトークンで認証する**。Google ログインできないため、端末ごとに 32 バイトの乱数のトークンを発行する。
  DB には SHA-256 のハッシュしか残さないので、控え損ねたら端末を登録し直す
- **計測時刻は端末の時刻**（`measured_at`、UTC の ISO 文字列）。オフラインの間に溜めた分を後から送れるようにするため。
  「最新」も受信順ではなく計測時刻で決める
- **再送しても二重にならない**。`(device_id, measured_at)` を一意にしているので、送信が途中で切れたら丸ごと送り直してよい
- **計測は 30 日で消す**。Cron は使わず、受信のたびにその端末の 30 日より古い計測を消す
  （vinext の Worker のエントリは fetch しか持たず、Cron を足すにはエントリを自前で書く必要があるため）。
  送信が止まった端末の計測はそのまま残るので、使わなくなった端末は消す
- **端末の時計の狂いを許すのは 5 分まで**。それより未来の計測は飛ばす（グラフの先に点が出てしまうため）
- **Wi-Fi の情報はすべて省略できる**。macOS 14.4 以降は位置情報の権限が無いと SSID が取れないなど、OS によって取れる値が違うため
- **グラフは区間ごとの平均**。24 時間は 5 分、7 日は 30 分にまとめる。1 分ごとの計測を 7 日分そのまま描くと 1 万点を超えて潰れるため

## 技術構成

| 領域           | 採用技術                                          |
| -------------- | ------------------------------------------------- |
| フレームワーク | Next.js 16 (App Router)                           |
| 実行環境       | Cloudflare Workers ([vinext](https://vinext.dev)) |
| DB             | Cloudflare D1 + Drizzle ORM                       |
| 認証           | better-auth + Google OAuth + 許可メールリスト     |
| UI             | Tailwind CSS v4（グラフはサーバで描く SVG）       |
| テスト         | Vitest + Miniflare（本物の D1 を起動して検証）    |

## セットアップ

このアプリはモノレポ [cloudflare-apps](../../README.md) の一部。**依存はリポジトリ
直下でまとめて入れる**（lockfile はルートに 1 つしかないため、このディレクトリで
`npm ci` は通らない）。

```bash
# リポジトリ直下で
npm ci

# 以降はこのディレクトリで

# 環境変数
cp .dev.vars.example .dev.vars
# AUTH_SECRET は openssl rand -base64 32 で生成
# AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET は Google Cloud Console で発行
# ALLOWED_EMAILS にログインを許可するメールアドレスをカンマ区切りで記入

# ローカル D1 にマイグレーションを適用
npm run db:migrate:local

npm run dev
```

Google OAuth の承認済みリダイレクト URI には以下を登録する。

- `http://localhost:3000/api/auth/callback/google`（ローカル）
- `https://wifi-monitor.a2ito.work/api/auth/callback/google`（本番）

## よく使うコマンド

| コマンド                               | 用途                                        |
| -------------------------------------- | ------------------------------------------- |
| `npm run dev`                          | 開発サーバ                                  |
| `npm test`                             | テスト（Miniflare で D1 を起動）            |
| `npm run lint` / `npm run typecheck`   | 静的チェック                                |
| `npm run db:generate`                  | スキーマ変更からマイグレーション SQL を生成 |
| `npm run db:migrate:local` / `:remote` | マイグレーション適用                        |
| `npm run build` / `npm start`          | ビルドして Workers ランタイムでローカル確認 |
| `npm run cf:deploy`                    | Cloudflare へデプロイ                       |

## デプロイ

main への push を Cloudflare の [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
が検知し、ビルドしてデプロイする。設定はルートの `terraform/` が持つ。

| 項目              | 値                                         |
| ----------------- | ------------------------------------------ |
| Root directory    | `apps/wifi-monitor`                        |
| Build command     | `npm run cf:build`                         |
| Deploy command    | `npm run cf:deploy`                        |
| Git branch        | `main`                                     |
| Build watch paths | `apps/wifi-monitor/*`、`package-lock.json` |
| Build variables   | `D1_DATABASE_ID`, `APP_HOSTNAME`           |

Worker の設定は `cloudflare.config.ts`。実 ID と公開ホスト名はリポジトリに含めず、これらの変数から読む。
読むのは本番のビルド（`vite build` とデプロイ）のときだけで、手元の開発ではシェルに入っていても使わない。
未設定のまま `cf:build` / `cf:deploy` を流すと、最初に止まる（`../../scripts/check-cf-env.mjs`）。

マイグレーションは `npm run cf:deploy` の中でデプロイより先に適用される。カラムやテーブルを消す変更は
2 回に分けて出す（expand / contract）。

### 初回だけ手でやること

D1（`wifi-monitor-db`）は Terraform が作る（`terraform/config_apps.tf` の `d1_databases`）。
ID は apply のあとに `terraform state show 'cloudflare_d1_database.app["wifi-monitor"]'` で調べ、
Build variables の `D1_DATABASE_ID` に書いてもう一度 apply する（`terraform/README.md` の「アプリを足す」）。

ログインのセッションは暗号化した Cookie だけで持つ（better-auth のステートレス構成）。
ログインから 30 日で必ずログインし直しになる。

Secret（`AUTH_SECRET` / `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` / `ALLOWED_EMAILS`）は
Terraform が入れる。名前は `cloudflare.config.ts` の `env` にも `bindings.secret()` で宣言してある。
