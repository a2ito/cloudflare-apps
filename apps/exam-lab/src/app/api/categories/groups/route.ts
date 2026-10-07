import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/db";
import { groups } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const examId = Number(new URL(request.url).searchParams.get("examId"));
  const db = getDB();

  const items = await db.select().from(groups).where(eq(groups.examId, examId));

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { examId, name } = (await request.json()) as {
    examId?: number;
    name?: string;
  };
  if (!examId || !name)
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  const db = getDB();
  const [row] = await db.insert(groups).values({ examId, name }).returning();
  return NextResponse.json(row, { status: 201 });
}
