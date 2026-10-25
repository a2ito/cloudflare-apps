# cloudflare-apps

Cloudflare Workers で動く Next.js アプリをまとめたモノレポ。

アプリごとにリポジトリを分けていたが、スタックが同一なのに依存の更新も CI の
設定も人数ぶんではなくリポジトリぶん必要になっていた。1 つにまとめて、
セキュリティ対応と標準化を 1 回で済ませる。

## アプリ一覧

| アプリ                                  | 本番                             | Worker            | 概要                                                                                 | 呼び名                                                                                |
| --------------------------------------- | -------------------------------- | ----------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [price-tracker](apps/price-tracker)     | https://price-tracker.a2ito.work | `price-tracker`   | 店舗ごとの価格を容量あたりの単価で比較する最安値メモ                                 | 最安値メモ、値段・単価の比較                                                          |
| [spec-compare](apps/spec-compare)       | https://spec-compare.a2ito.work  | `spec-compare`    | 同じカテゴリの商品（同スペック帯の PC など）をスペックと価格で比べる                 | 商品比較、スペック比較、PC・モニター選び                                              |
| [tabilog](apps/tabilog)                 | https://tabilog.a2ito.work       | `tabilog`         | 旅先の食事・買い物を記録して振り返る旅行メモ                                         | たびログ、旅行メモ                                                                    |
| [sakelog](apps/sakelog)                 | https://sakelog.a2ito.work       | `sakelog`         | ワインから日本酒まで、飲んだお酒を 5 軸の評価付きで残すメモ                          | さけログ、お酒・ワイン・日本酒・ビール                                                |
| [kcalog](apps/kcalog)                   | https://kcalog.a2ito.work        | `kcalog`          | 食べたものとカロリーを記録して 1 日の摂取量を振り返るメモ                            | カロリー、食事記録                                                                    |
| [liftlog](apps/liftlog)                 | https://liftlog.a2ito.work       | `liftlog`         | 目標から今日のメニューを提案し、実際の重量と回数を残す筋トレ記録                     | 筋トレ、トレーニング記録                                                              |
| [lifelog](apps/lifelog)                 | https://lifelog.a2ito.work       | `lifelog`         | 日々の出来事を写真付きの日記として残すライフログ                                     | 日記、写真日記                                                                        |
| [account-book](apps/account-book)       | https://account-book.a2ito.work  | `account-book`    | グループ単位で管理する家計簿                                                         | 家計簿、支出、サブスク                                                                |
| [flash-english](apps/flash-english)     | https://flash-english.a2ito.work | `flash-english`   | 日本文を見て英文を瞬間的に言う、瞬間英作文の練習帳                                   | 瞬間英作文、英語の練習                                                                |
| [exam-lab](apps/exam-lab)               | https://exam-lab.a2ito.work      | `exam-lab`        | 資格試験の問題を管理・学習する                                                       | 資格試験、問題集                                                                      |
| [warikan](apps/warikan)                 | https://warikan.a2ito.work       | `warikan`         | ログイン不要の割り勘。最小回数で自動精算する                                         | 割り勘、立替の精算                                                                    |
| [wordle](apps/wordle)                   | https://wordle.a2ito.work        | `wordle`          | ブラウザで遊ぶ Wordle                                                                | Wordle、単語当て                                                                      |
| [number-logic](apps/number-logic)       | https://number-logic.a2ito.work  | `number-logic`    | 数独ベースのロジックパズル                                                           | 数独、ナンプレ                                                                        |
| [dev-toolbox](apps/dev-toolbox)         | https://toolbox.a2ito.work       | `dev-toolbox`     | パスワード生成や Unix time 変換などの開発者向けユーティリティ                        | toolbox、開発ツール、パスワード生成、Unix time                                        |
| [planning-porker](apps/planning-porker) | https://porker.a2ito.work        | `planning-porker` | チーム見積り用のプランニングポーカー                                                 | プランニングポーカー、見積り、porker                                                  |
| [games](apps/games)                     | https://game.a2ito.work          | `games`           | ブラウザゲームを 1 本にまとめたゲーム集（一覧は [apps/games](apps/games) の README） | ゲーム、ソリティア、テトリス、2048、マインスイーパー、スネーク、hexspin、英単語クイズ |

## 使い方

依存はルートで一度だけ入れる。`node_modules` は workspaces がルートへ巻き上げる。

```bash
npm install
```

アプリ 1 つに対してスクリプトを流すときは `-w` でワークスペースを指定する。

```bash
npm run dev -w apps/price-tracker
npm run build -w apps/price-tracker
```

全アプリに対して流すものはルートに用意してある。

```bash
npm run lint
npm run test
npm run typecheck
```

## esbuild をアプリの依存に置いている理由

どのアプリも `esbuild` を直接使わないが、全アプリの `dependencies` に入れている。

`@opennextjs/cloudflare` は `esbuild` を import するのに依存として宣言しておらず、
`@opennextjs/aws` 経由でルートへ巻き上がるのを当てにしている。巻き上がるかどうかは
同時に入る他の依存で変わるため、アプリによっては
`Cannot find package 'esbuild'` で落ちる。

**ルートの `package.json` に置いても効かない。** Workers Builds は
`npm ci --workspace=apps/<name>` 相当で、対象のアプリだけを入れる。ルート自身の
依存は無視される。手元の `npm install` は全部入れるため、この差は手元では出ない。
確かめるときは `npm ci --workspace=apps/<name>` で再現する。

`devDependencies` でも届かない。本番依存だけが入る。

## デプロイ

Cloudflare Workers Builds が main への push で動く。設定（下の表）と各 Worker の Secret は
[terraform/](terraform) で管理している。ダッシュボードの
**Workers & Pages > 各 Worker > Settings > Builds** で変えても、次の apply で戻る。

| 項目                         | 値                                   |
| ---------------------------- | ------------------------------------ |
| Repository                   | `a2-ito/cloudflare-apps`             |
| Branch                       | `main`                               |
| Root directory               | `apps/<name>`                        |
| Build command                | `npm run cf:build`                   |
| Deploy command               | `npm run cf:deploy`                  |
| Build watch paths            | `apps/<name>/*`、`package-lock.json` |
| Non-production branch builds | 無効                                 |

**ルートディレクトリはアプリのディレクトリを指す。** Worker 名は、そこに置かれた
Wrangler 設定の `name` と一致していなければビルドが落ちる。

**build watch paths に `package-lock.json` を含める。** アプリ配下だけを見ていると、
依存をまとめて更新したときに再デプロイされない。

**non-production branch builds は無効にする。** PR 段階の検証は GitHub Actions が
やっているので Cloudflare 側で二重に回す必要がない。加えて `wrangler.jsonc` を組み立てる
`cf:config` は `D1_DATABASE_ID` などの環境変数を要求するが、これらは production 環境にしか
入っていないため、PR ブランチのビルドは環境変数が未設定で落ちる。

アプリを追加したら `terraform/config_apps.tf` に足す。足し忘れると、
リポジトリは繋がっているのにデプロイだけ起きないという状態になる。

**Worker 名は Wrangler 設定の `name` と一致していなければならない。** 一致しないと
Workers Builds が CI 側の名前で上書きし、自分自身への service binding が解決できずに
デプロイが落ちる。ダッシュボードで Worker を改名したら、`wrangler.jsonc` も合わせる。

Worker の改名自体は非破壊で、Worker の実体 (tag) もカスタムドメインも保たれる。
`account-book` は移行の際に `account-book-on-cf` から改名した。`-on-cf` は
account-book という名前を Vercel 時代のリポジトリに取られていた名残りだった。

## lint と書式

[lint.yml](.github/workflows/lint.yml) が PR と main への push で、[a2-ito/shared-workflows](https://github.com/a2-ito/shared-workflows) の
再利用ワークフローを使って formatter と linter を回す。1 つでも引っかかれば失敗する。

- **Prettier**（既定の設定）: TS/JS・CSS・JSON・YAML・Markdown。生成されるファイルはルートの `.prettierignore` で外す
- **ESLint**: 各アプリの `npm run lint`（CI の quality ジョブ）
- **terraform fmt / tflint**、**shfmt / shellcheck**（スペース 2 つ）、**actionlint**

手元で整えるときは、ルートで `npx prettier@3.9.10 --write .` を流す。

## 脆弱性の検査

[security.yml](.github/workflows/security.yml) が PR・main への push・毎日 6 時（JST）に、
[a2-ito/shared-workflows](https://github.com/a2-ito/shared-workflows) の再利用ワークフローで次の 2 つを回す。
結果はどちらも Security タブ（code scanning）に載る。

- **Trivy**: `package-lock.json` の脆弱性（間接依存を含む）、`terraform/` の設定ミス、秘密情報のコミット。HIGH 以上で失敗する
- **CodeQL**: 自分たちが書いたコード（全アプリの TS/JS と `.github/workflows`）。リポジトリ設定の default setup は使わない
  （GitHub の Terraform プロバイダが扱えず、設定をコードに残すため）

依存の更新は Renovate が PR を作る。

- 直接の依存は Renovate の PR で上げる。間接依存は親の依存を上げるか、使っていなければ外す
- 直せない・届かないと判断した Trivy の検出は `.trivyignore.yaml` に理由と見直す期限を書いて見送る
- CodeQL の誤検知や機能上避けられない指摘（例: OGP チェッカーの SSRF）は、理由を書いてアラートを閉じる
- required status checks には入れていない。無関係な依存に新しい脆弱性が出たとき、他の PR のマージまで止めないため

## ゲーム

認証の要らないゲームは、アプリを分けずに [apps/games](apps/games) の 1 本に
`/<name>` として足す。Worker も Workers Builds の設定も増えない。
足し方は apps/games の README にある。

## スキーマ変更

**D1 のマイグレーションはデプロイ時に自動で適用する。** D1 を使うアプリは
`cf:deploy` の中で `db:migrate:remote` をデプロイより先に流す。
Deploy command をアプリごとに変えると、ダッシュボードの設定漏れに気付けない。
実際に、README には自動適用と書きながら Deploy command が `npm run cf:deploy` だけになっていて、
新しいアプリのテーブルが本番に作られなかったことがある。

適用からデプロイ完了までは「新しいスキーマ + 古いコード」が同時に存在するため、
カラムやテーブルを消す変更は 2 回に分けて出す（expand / contract）。

データ移行を伴う場合は先に `wrangler d1 export --remote` で控えを取る。

## wrangler.jsonc

実 ID と公開ホスト名を含むため追跡していない。各アプリの
`wrangler.jsonc.example` を雛形として使う。`cf:config` が埋める値（`D1_DATABASE_ID`・`APP_HOSTNAME` など）は
Workers Builds の Build variables で、同じ理由で `terraform/terraform.tfvars`（追跡しない）に書く。
