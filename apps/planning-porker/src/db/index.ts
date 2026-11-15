import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

export function getDB() {
  return drizzle(env.DB, { schema });
}

export type DB = ReturnType<typeof getDB>;
