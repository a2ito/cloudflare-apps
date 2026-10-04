import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import * as schema from "@/db/schema";

/**
 * テスト用に本物の D1 / R2（Miniflare 上の workerd）を立てる。
 * drizzle/ 配下のマイグレーション SQL をそのまま適用するので本番とスキーマがずれない。
 */
/** マイグレーションを途中まで適用した環境を作る（移行 SQL の検証用） */
export async function createTestEnvUpTo(lastMigration: string) {
	return createTestEnv({ upTo: lastMigration });
}

export async function createTestEnv(opts: { upTo?: string } = {}) {
	// Miniflare 5 は wrangler 設定風の新スキーマになったため、簡潔な v4 形式から変換して渡す
	const mf = new Miniflare(
		convertV4MiniflareOptions({
			modules: true,
			script: "export default { fetch() { return new Response('ok'); } }",
			d1Databases: { DB: "price-tracker-test" },
			r2Buckets: ["IMAGES_BUCKET"],
		}),
	);

	const d1 = await mf.getD1Database("DB");
	const bucket = await mf.getR2Bucket("IMAGES_BUCKET");
	await applyMigrations(d1, opts.upTo);

	const env = { DB: d1, IMAGES_BUCKET: bucket } as unknown as CloudflareEnv;
	const db = drizzle(d1, { schema });

	return {
		env,
		db,
		d1,
		/** 指定したマイグレーションを追加で適用する */
		async applyMigration(prefix: string) {
			const dir = join(process.cwd(), "drizzle");
			const file = readdirSync(dir).find((f) => f.startsWith(prefix) && f.endsWith(".sql"));
			if (!file) throw new Error(`マイグレーションが見つかりません: ${prefix}`);
			const sql = readFileSync(join(dir, file), "utf8");
			const statements = sql
				.split("--> statement-breakpoint")
				.map((s) => s.trim())
				.filter((s) => s !== "");
			for (const statement of statements) await d1.prepare(statement).run();
		},
		bucket,
		dispose: () => mf.dispose(),
		/** 全テーブルと R2 バケットを空にする（AUTOINCREMENT の連番もリセット） */
		async truncate() {
			const listed = await bucket.list();
			if (listed.objects.length > 0) await bucket.delete(listed.objects.map((o) => o.key));
			await d1.batch([
				d1.prepare("DELETE FROM price_records"),
				d1.prepare("DELETE FROM variants"),
				d1.prepare("DELETE FROM products"),
				d1.prepare("DELETE FROM categories"),
				d1.prepare("DELETE FROM sqlite_sequence"),
			]);
		},
	};
}

export type TestEnv = Awaited<ReturnType<typeof createTestEnv>>;

async function applyMigrations(d1: D1Database, upTo?: string): Promise<void> {
	const dir = join(process.cwd(), "drizzle");
	let files = readdirSync(dir)
		.filter((f) => f.endsWith(".sql"))
		.sort();
	if (upTo) {
		const index = files.findIndex((f) => f.startsWith(upTo));
		if (index < 0) throw new Error(`マイグレーションが見つかりません: ${upTo}`);
		files = files.slice(0, index + 1);
	}
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
export function formData(fields: Record<string, string | number | File | undefined>): FormData {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) {
		if (v === undefined) continue;
		fd.append(k, v instanceof File ? v : String(v));
	}
	return fd;
}

export function fakeImage(type = "image/jpeg", bytes = 1024, name = "photo.jpg"): File {
	return new File([new Uint8Array(bytes)], name, { type });
}
