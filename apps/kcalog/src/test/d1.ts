import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import * as schema from "@/db/schema";

/**
 * テスト用に本物の D1（Miniflare 上の workerd）を立てる。
 * drizzle/ 配下のマイグレーション SQL をそのまま適用するので本番とスキーマがずれない。
 */
export async function createTestEnv() {
  // Miniflare 5 は wrangler 設定風の新スキーマになったため、簡潔な v4 形式から変換して渡す
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: "export default { fetch() { return new Response('ok'); } }",
      d1Databases: { DB: "kcalog-test" },
    }),
  );

  const d1 = await mf.getD1Database("DB");
  await applyMigrations(d1);

  const env = { DB: d1 } as unknown as CloudflareEnv;
  const db = drizzle(d1, { schema });

  return {
    env,
    db,
    d1,
    dispose: () => mf.dispose(),
    /** 全テーブルを空にする（AUTOINCREMENT の連番もリセット） */
    async truncate() {
      await d1.batch([
        d1.prepare("DELETE FROM meals"),
        d1.prepare("DELETE FROM users"),
        d1.prepare("DELETE FROM sqlite_sequence"),
      ]);
    },
  };
}

export type TestEnv = Awaited<ReturnType<typeof createTestEnv>>;

async function applyMigrations(d1: D1Database): Promise<void> {
  const dir = join(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    await d1.batch(statements.map((s) => d1.prepare(s)));
  }
}

/** FormData を手早く組み立てる */
export function formData(
  fields: Record<string, string | number | undefined>,
): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    fd.append(k, String(v));
  }
  return fd;
}
