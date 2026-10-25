// src/app/api/categories/route.ts
import { NextResponse } from "next/server";
//import { getDB, Env } from '@/lib/db'
//import { getDB } from '@/lib/db'
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { categories } from "@/db/schema";
import { getSessionUser } from "@/lib/session";

type CategorySchema = {
  name: string;
};

export async function GET() {
  // const db = getDB()
  // const env = (request as any).env
  // const db = env.DB as D1Database
  const { env } = getCloudflareContext();
  const db = drizzle(env.DB);

  //const rows = await db
  //  .prepare('SELECT * FROM categories ORDER BY id')
  //  .all()
  //return NextResponse.json(rows.results)

  const result = await db.select().from(categories);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const userId = await getSessionUser(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { env } = getCloudflareContext();
  const db = drizzle(env.DB);

  const { name } = (await request.json()) as CategorySchema;

  await db.insert(categories).values({
    name,
  });

  return NextResponse.json({ ok: true });
}
