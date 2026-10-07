import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/db";
import { examSessions } from "@/db/schema";
import { eq } from "drizzle-orm";

/** 更新 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const idNum = Number(id);
  const body = (await request.json()) as {
    name?: string;
    examId?: number;
    note?: string;
  };

  const db = getDB();

  await db.update(examSessions).set(body).where(eq(examSessions.id, idNum));

  return NextResponse.json({ ok: true });
}

/** 削除 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const idNum = Number(id);
  const db = getDB();

  await db.delete(examSessions).where(eq(examSessions.id, idNum));

  return NextResponse.json({ ok: true });
}
