import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { rooms, participants, votes } from "@/db/schema";
import type { RoomData } from "@/types/room";
import { getDB } from "@/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = getDB();
    const roomId = (await params).id;

    // ① room
    const roomRows = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (roomRows.length === 0) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const room = roomRows[0];

    // ② participants
    const participantRows = await db
      .select()
      .from(participants)
      .where(eq(participants.roomId, roomId));

    // ③ votes
    const voteRows = await db
      .select()
      .from(votes)
      .where(eq(votes.roomId, roomId));

    // ④ 整形
    const participantsList = participantRows.map((p) => p.name);

    const votesMap = voteRows.reduce(
      (acc, v) => {
        if (v.value !== null) {
          acc[v.participantName] = v.value;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const response: RoomData = {
      id: room.id,
      createdAt: room.createdAt,
      revealed: Boolean(room.revealed),
      participants: participantsList,
      votes: votesMap,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/room/:id]", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
