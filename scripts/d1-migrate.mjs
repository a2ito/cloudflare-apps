// drizzle/ のマイグレーションを D1 に当てる。アプリのディレクトリで実行する。
//   node ../../scripts/d1-migrate.mjs --local    ローカルの模擬 D1
//   node ../../scripts/d1-migrate.mjs --remote   本番（D1_DATABASE_ID が要る）
//   --dir <ディレクトリ> でマイグレーションの置き場を変えられる（既定は drizzle）
//
// 適用済みの記録は wrangler と同じ d1_migrations テーブルに残るので、
// wrangler で当ててきた本番の D1 にもそのまま続きから当たる。
import { resolveD1DatabaseId, runCf } from "./d1.mjs";

const args = process.argv.slice(2);
const dirIndex = args.indexOf("--dir");
const dir = dirIndex === -1 ? "drizzle" : args[dirIndex + 1];
const rest = dirIndex === -1 ? args : args.filter((_, i) => i !== dirIndex && i !== dirIndex + 1);
const mode = rest.includes("--remote") ? "remote" : rest.includes("--local") ? "local" : null;
if (mode === null || rest.length !== 1 || !dir || dir.startsWith("--")) {
  console.error("使い方: node ../../scripts/d1-migrate.mjs --local | --remote [--dir <ディレクトリ>]");
  process.exit(1);
}

try {
  const id = resolveD1DatabaseId(mode);
  await runCf(["d1", "migrations", "apply", id, "--dir", dir, ...(mode === "local" ? ["--local"] : [])]);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
