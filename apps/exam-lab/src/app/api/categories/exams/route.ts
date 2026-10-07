import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/db";
import { exams } from "@/db/schema";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const db = getDB();
  const items = await db.select().from(exams);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { name } = (await request.json()) as { name?: string };
  if (!name) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const db = getDB();
  const [row] = await db.insert(exams).values({ name }).returning();
  return NextResponse.json(row, { status: 201 });
}
