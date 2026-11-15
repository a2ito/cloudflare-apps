import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { env } from "cloudflare:workers";

// `cloudflare:workers` は workerd の中でしか解決できない。テストでは vitest.config.mts の
// alias で src/test/cloudflare-workers.ts に差し替わり、触ると投げる env になる。
export function getDB() {
  return drizzle(env.DB, { schema });
}

export type DB = ReturnType<typeof getDB>;
