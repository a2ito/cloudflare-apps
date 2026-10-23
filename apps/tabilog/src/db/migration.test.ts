import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 0001・0002 は既存データを作り替える移行を含む。
 * 空の DB に当てるテストでは移行結果を確認できないため、
 * 手前までを適用した DB にデータを入れてから当てて確かめる。
 */
function statementsOf(prefix: string): string[] {
  const dir = join(process.cwd(), "drizzle");
  const file = readFileSync(join(dir, `${prefix}.sql`), "utf8");
  return file
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

describe("0001 の移行", () => {
  it("既存の記録に旅行の通貨を埋める", async () => {
    const { convertV4MiniflareOptions, Miniflare } = await import("miniflare");
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script: "export default { fetch() { return new Response('ok'); } }",
        d1Databases: { DB: "tabilog-migration-test" },
      }),
    );
    const d1 = await mf.getD1Database("DB");

    for (const sql of statementsOf("0000_smooth_hulk"))
      await d1.prepare(sql).run();

    await d1
      .prepare("INSERT INTO users (id, email) VALUES (1, 'a@example.com')")
      .run();
    await d1
      .prepare(
        "INSERT INTO trips (id, name, currency, rate_to_jpy, created_by) VALUES (1, '台湾', 'TWD', 4.7, 1)",
      )
      .run();
    await d1
      .prepare(
        "INSERT INTO entries (id, trip_id, kind, title, amount_minor, happened_at, author_id) VALUES (1, 1, 'food', '小籠包', 20000, '2026-03-01T12:00', 1)",
      )
      .run();
    // 金額のない記録には通貨を入れない
    await d1
      .prepare(
        "INSERT INTO entries (id, trip_id, kind, title, happened_at, author_id) VALUES (2, 1, 'other', 'MRT', '2026-03-01T09:00', 1)",
      )
      .run();

    for (const sql of statementsOf("0001_remarkable_rocket_raccoon"))
      await d1.prepare(sql).run();

    const rows = await d1
      .prepare("SELECT id, amount_currency FROM entries ORDER BY id")
      .all<{
        id: number;
        amount_currency: string | null;
      }>();
    expect(rows.results).toEqual([
      { id: 1, amount_currency: "TWD" },
      { id: 2, amount_currency: null },
    ]);

    await mf.dispose();
  });
});

describe("0002 の移行", () => {
  it("旅行の通貨を trip_currencies に移し、円の旅行は行を作らない", async () => {
    const { convertV4MiniflareOptions, Miniflare } = await import("miniflare");
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script: "export default { fetch() { return new Response('ok'); } }",
        d1Databases: { DB: "tabilog-migration-0002-test" },
      }),
    );
    const d1 = await mf.getD1Database("DB");

    for (const prefix of [
      "0000_smooth_hulk",
      "0001_remarkable_rocket_raccoon",
    ]) {
      for (const sql of statementsOf(prefix)) await d1.prepare(sql).run();
    }

    await d1
      .prepare("INSERT INTO users (id, email) VALUES (1, 'a@example.com')")
      .run();
    await d1
      .prepare(
        "INSERT INTO trips (id, name, currency, rate_to_jpy, created_by) VALUES (1, '台湾', 'twd', 4.7, 1)",
      )
      .run();
    // 円だけの旅行は現地通貨を持たない
    await d1
      .prepare(
        "INSERT INTO trips (id, name, currency, rate_to_jpy, created_by) VALUES (2, '国内', 'JPY', 1, 1)",
      )
      .run();

    for (const sql of statementsOf("0002_solid_radioactive_man"))
      await d1.prepare(sql).run();

    const rows = await d1
      .prepare(
        "SELECT trip_id, code, rate_to_jpy FROM trip_currencies ORDER BY trip_id",
      )
      .all<{
        trip_id: number;
        code: string;
        rate_to_jpy: number;
      }>();
    expect(rows.results).toEqual([
      { trip_id: 1, code: "TWD", rate_to_jpy: 4.7 },
    ]);

    await mf.dispose();
  });
});
