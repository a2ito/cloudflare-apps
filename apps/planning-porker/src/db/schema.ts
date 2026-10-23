import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * rooms
 */
export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  revealed: integer("revealed").notNull().default(0),
});

/**
 * participants
 */
export const participants = sqliteTable(
  "participants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roomId: text("room_id").notNull(),
    name: text("name").notNull(),
    joinedAt: text("joined_at").notNull(),
  },
  (table) => ({
    roomNameUnique: uniqueIndex("participants_room_name_unique").on(
      table.roomId,
      table.name,
    ),

    roomIdx: index("participants_room_id_idx").on(table.roomId),
  }),
);

/**
 * votes
 */
export const votes = sqliteTable(
  "votes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roomId: text("room_id").notNull(),
    participantName: text("participant_name").notNull(),
    value: integer("value"),
    votedAt: text("voted_at"),
  },
  (table) => ({
    roomParticipantUnique: uniqueIndex("votes_room_participant_unique").on(
      table.roomId,
      table.participantName,
    ),

    roomIdx: index("votes_room_id_idx").on(table.roomId),
  }),
);
