import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/db";
import { examSessions } from "@/db/schema";
import { eq } from "drizzle-orm";

/** 一覧取得 */
export async function GET(request: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const examId = Number(new URL(request.url).searchParams.get("examId"));
  if (!examId)
    return NextResponse.json({ error: "examId-required" }, { status: 400 });

  const db = getDB();

  const items = await db
    .select()
    .from(examSessions)
    .where(eq(examSessions.examId, examId));

  return NextResponse.json({ items });
}

/** 登録 */
export async function POST(request: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const body = await request.json();
  const { examId, name, note } = body as {
    examId?: number;
    name?: string;
    note?: string;
  };

  if (!examId || !name) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const db = getDB();

  const [row] = await db
    .insert(examSessions)
    .values({
      examId,
      name,
      note,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
