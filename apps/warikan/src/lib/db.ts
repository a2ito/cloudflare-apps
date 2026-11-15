import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "@/db/schema";

// Cloudflare の D1 バインディングから Drizzle クライアントを取得する。
// `cloudflare:workers` は workerd の中でしか解決できない。テストでは vitest.config.mts の
// alias で src/test/cloudflare-workers.ts に差し替わり、触ると投げる env になる。
export function getDb() {
  return drizzle(env.DB, { schema });
}

export { schema };
