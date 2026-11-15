// 本番のビルドとデプロイの前に、cloudflare.config.ts が読む環境変数が揃っているか確かめる。
//   node ../../scripts/check-cf-env.mjs D1_DATABASE_ID APP_HOSTNAME
//
// cloudflare.config.ts は手元の開発や型の生成でも評価できるよう、未設定なら仮の値を使う。
// 仮の値のままデプロイすると、カスタムドメインが外れたり存在しない D1 を参照したりするので、
// Workers Builds ではここで止める。値は Terraform が Build variables に入れている。
const required = process.argv.slice(2);
if (required.length === 0) {
  console.error("使い方: node ../../scripts/check-cf-env.mjs <環境変数名>...");
  process.exit(1);
}

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`環境変数が未設定です: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("cloudflare.config.ts が読む環境変数は揃っています");
