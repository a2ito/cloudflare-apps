import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/db";
import { exams } from "@/db/schema";
import { eq } from "drizzle-orm";

/** 一覧取得 */
export async function GET(request: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const db = getDB();

  const items = await db.select().from(exams);

  return NextResponse.json({ items });
}

/** 登録 */
export async function POST(request: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const body = await request.json();
  const { name } = body as {
    name?: string;
  };

  if (!name) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const db = getDB();

  const [row] = await db
    .insert(exams)
    .values({
      name,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
