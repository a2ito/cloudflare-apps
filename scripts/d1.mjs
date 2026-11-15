// D1 を cf CLI で操作するための共通処理。
//
// cf の d1 コマンドは名前やバインディング名を受け付けず、D1 の ID（UUID）しか取らない。
// ローカルの模擬 D1 も ID ごとに分かれるので、開発サーバ（cloudflare.config.ts）と
// ここで同じ ID を使わないと、マイグレーションを当てた D1 と画面が読む D1 が別物になる。
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * ローカルの模擬 D1 の ID。各アプリの cloudflare.config.ts も手元の開発ではこれを使う。
 * cf は UUID v4 の形でないと受け付けないため、版と variant の桁だけ立ててある。
 */
export const LOCAL_D1_DATABASE_ID = "00000000-0000-4000-8000-000000000000";

/** cf に渡さない環境変数。どれかがあると OAuth（npx cf auth login）ではなく API トークンで認証してしまう */
const API_TOKEN_ENV = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY", "CLOUDFLARE_EMAIL"];

/**
 * 対象の D1 の ID を返す。
 * ローカルは常に LOCAL_D1_DATABASE_ID（シェルに本番の ID が入っていても使わない。開発サーバと揃えるため）。
 * 本番は D1_DATABASE_ID が必須（仮の ID で本番を叩かないため）。
 * @param {"local" | "remote"} mode
 * @returns {string}
 */
export function resolveD1DatabaseId(mode) {
  if (mode === "local") return LOCAL_D1_DATABASE_ID;
  const fromEnv = process.env.D1_DATABASE_ID;
  if (fromEnv) return fromEnv;
  throw new Error("本番の D1 を操作するには環境変数 D1_DATABASE_ID が要ります");
}

/**
 * cf を実行する。
 * @param {string[]} args
 * @param {{ oauth?: boolean }} [options] oauth: true なら API トークンの環境変数を外して OAuth で認証させる
 * @returns {Promise<void>}
 */
export async function runCf(args, options = {}) {
  const env = { ...process.env };
  if (options.oauth) for (const name of API_TOKEN_ENV) delete env[name];

  console.error(`npx cf ${args.join(" ")}`);
  const code = await new Promise((resolve, reject) => {
    const child = spawn("npx", ["cf", ...args], { env, stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("close", resolve);
  });
  if (code !== 0) {
    const hint = options.oauth ? "。未ログインなら npx cf auth login を実行してください" : "";
    throw new Error(`cf ${args.slice(0, 3).join(" ")} が終了コード ${code} で失敗しました${hint}`);
  }
}

/**
 * SQL の文を 1 つの batch（D1 では 1 トランザクション）として流す。
 * 途中の文が失敗したら全体が巻き戻る。
 * @param {readonly string[]} statements 末尾の ; は付けても付けなくてもよい
 * @param {"local" | "remote"} mode
 * @returns {Promise<void>}
 */
export async function executeD1(statements, mode) {
  if (statements.length === 0) throw new Error("流す SQL がありません");
  const id = resolveD1DatabaseId(mode);
  if (mode === "local") return executeLocalD1(statements, id);

  const dir = await mkdtemp(join(tmpdir(), "cloudflare-apps-d1-"));
  const file = join(dir, "batch.json");
  try {
    await writeFile(file, JSON.stringify(statements.map((sql) => ({ sql }))), "utf8");
    await runCf(["d1", "query", id, "--batch", `@${file}`, "--quiet"], { oauth: true });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** executeLocalD1 が流した SQL の記録先。本物のマイグレーションの記録（d1_migrations）と混ぜない */
const LOCAL_SQL_RUNS_TABLE = "_local_sql_runs";

/**
 * ローカルの模擬 D1 に流す。
 *
 * cf d1 query は --local に対応していない。一方 cf d1 migrations apply は --local で動き、
 * 開発サーバと同じ .cloudflare/state を使う。そこで、流したい SQL を一時ディレクトリに
 * 使い捨てのマイグレーションとして置いて当てる。記録は専用のテーブルに残る（ローカルだけ）。
 * @param {readonly string[]} statements
 * @param {string} id
 * @returns {Promise<void>}
 */
async function executeLocalD1(statements, id) {
  const dir = await mkdtemp(join(tmpdir(), "cloudflare-apps-d1-"));
  try {
    // 同じ名前だと適用済みとして飛ばされるので、毎回違う名前にする
    await writeFile(join(dir, `${Date.now()}_run.sql`), `${statements.map((s) => s.replace(/;\s*$/, "")).join(";\n")};\n`, "utf8");
    await runCf(["d1", "migrations", "apply", id, "--local", "--dir", dir, "--table", LOCAL_SQL_RUNS_TABLE, "--quiet"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
