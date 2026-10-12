import { drizzle } from "drizzle-orm/d1";
import { getEnv } from "@/lib/cloudflare";
import * as schema from "./schema";

export async function getDb() {
	const env = await getEnv();
	return drizzle(env.DB, { schema });
}

export type Db = Awaited<ReturnType<typeof getDb>>;
