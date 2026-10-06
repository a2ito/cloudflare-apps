# cloudflare-apps

Cloudflare Workers で動く Next.js アプリをまとめたモノレポ。

アプリごとにリポジトリを分けていたが、スタックが同一なのに依存の更新も CI の
設定も人数ぶんではなくリポジトリぶん必要になっていた。1 つにまとめて、
セキュリティ対応と標準化を 1 回で済ませる。

## アプリ一覧

| アプリ | 本番 | Worker | 概要 |
| --- | --- | --- | --- |
| [price-tracker](apps/price-tracker) | https://price-tracker.a2ito.work | `price-tracker` | 店舗ごとの価格を容量あたりの単価で比較する最安値メモ |
| [tabilog](apps/tabilog) | https://tabilog.a2ito.work | `tabilog` | 旅先の食事・買い物を記録して振り返る旅行メモ |
| [sakelog](apps/sakelog) | https://sakelog.a2ito.work | `sakelog` | ワインから日本酒まで、飲んだお酒を 5 軸の評価付きで残すメモ |
| [kcalog](apps/kcalog) | https://kcalog.a2ito.work | `kcalog` | 食べたものとカロリーを記録して 1 日の摂取量を振り返るメモ |
| [liftlog](apps/liftlog) | https://liftlog.a2ito.work | `liftlog` | 目標から今日のメニューを提案し、実際の重量と回数を残す筋トレ記録 |
| [lifelog](apps/lifelog) | https://lifelog.a2ito.work | `lifelog` | 日々の出来事を写真付きの日記として残すライフログ |
| [account-book](apps/account-book) | https://account-book.a2ito.work | `account-book` | グループ単位で管理する家計簿 |
| [exam-lab](apps/exam-lab) | https://exam-lab.a2ito.work | `exam-lab` | 資格試験の問題を管理・学習する |
| [warikan](apps/warikan) | https://warikan.a2ito.work | `warikan` | ログイン不要の割り勘。最小回数で自動精算する |
| [wordle](apps/wordle) | https://wordle.a2ito.work | `wordle` | ブラウザで遊ぶ Wordle |
| [number-logic](apps/number-logic) | https://number-logic.a2ito.work | `number-logic` | 数独ベースのロジックパズル |
| [dev-toolbox](apps/dev-toolbox) | https://toolbox.a2ito.work | `dev-toolbox` | パスワード生成や Unix time 変換などの開発者向けユーティリティ |
| [planning-porker](apps/planning-porker) | https://porker.a2ito.work | `planning-porker` | チーム見積り用のプランニングポーカー |
| [games](apps/games) | https://game.a2ito.work | `games` | klondike / tetris / english-vocabulary-quiz / ball-bounce を 1 本にまとめたゲーム集 |

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

Cloudflare Workers Builds が main への push で動く。設定はダッシュボードの
**Workers & Pages > 各 Worker > Settings > Builds** にあり、リポジトリには
残らないため、ここに控えておく。

| 項目 | 値 |
| --- | --- |
| Repository | `a2-ito/cloudflare-apps` |
| Branch | `main` |
| Root directory | `apps/<name>` |
| Build command | `npm run cf:build` |
| Deploy command | `npm run cf:deploy` |
| Build watch paths | `apps/<name>/*`、`package-lock.json` |
| Non-production branch builds | 無効 |

**ルートディレクトリはアプリのディレクトリを指す。** Worker 名は、そこに置かれた
Wrangler 設定の `name` と一致していなければビルドが落ちる。

**build watch paths に `package-lock.json` を含める。** アプリ配下だけを見ていると、
依存をまとめて更新したときに再デプロイされない。

**non-production branch builds は無効にする。** PR 段階の検証は GitHub Actions が
やっているので Cloudflare 側で二重に回す必要がない。加えて `wrangler.jsonc` を組み立てる
`cf:config` は `D1_DATABASE_ID` などの環境変数を要求するが、これらは production 環境にしか
入っていないため、PR ブランチのビルドは環境変数が未設定で落ちる。

アプリを追加したら、その Worker にも同じ設定を入れる。入れ忘れると、
リポジトリは繋がっているのにデプロイだけ起きないという状態になる。

**Worker 名は Wrangler 設定の `name` と一致していなければならない。** 一致しないと
Workers Builds が CI 側の名前で上書きし、自分自身への service binding が解決できずに
デプロイが落ちる。ダッシュボードで Worker を改名したら、`wrangler.jsonc` も合わせる。

Worker の改名自体は非破壊で、Worker の実体 (tag) もカスタムドメインも保たれる。
`account-book` は移行の際に `account-book-on-cf` から改名した。`-on-cf` は
account-book という名前を Vercel 時代のリポジトリに取られていた名残りだった。

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
`wrangler.jsonc.example` を雛形として使う。
