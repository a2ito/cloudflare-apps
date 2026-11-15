// drizzle/ のマイグレーションを D1 に当てる。アプリのディレクトリで実行する。
//   node ../../scripts/d1-migrate.mjs --local    ローカルの模擬 D1
//   node ../../scripts/d1-migrate.mjs --remote   本番（D1_DATABASE_ID が要る）
//
// 適用済みの記録は wrangler と同じ d1_migrations テーブルに残るので、
// wrangler で当ててきた本番の D1 にもそのまま続きから当たる。
import { resolveD1DatabaseId, runCf } from "./d1.mjs";

const args = process.argv.slice(2);
const mode = args.includes("--remote") ? "remote" : args.includes("--local") ? "local" : null;
if (mode === null || args.length !== 1) {
  console.error("使い方: node ../../scripts/d1-migrate.mjs --local | --remote");
  process.exit(1);
}

try {
  const id = resolveD1DatabaseId(mode);
  await runCf(["d1", "migrations", "apply", id, "--dir", "drizzle", ...(mode === "local" ? ["--local"] : [])]);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
