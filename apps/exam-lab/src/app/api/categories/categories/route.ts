import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const groupId = Number(new URL(request.url).searchParams.get("groupId"));
  const db = getDB();

  const items = await db
    .select()
    .from(categories)
    .where(eq(categories.groupId, groupId));

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { groupId, name } = (await request.json()) as {
    groupId?: number;
    name?: string;
  };
  if (!groupId || !name)
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  const db = getDB();
  const [row] = await db
    .insert(categories)
    .values({ groupId, name })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
