import { NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionUser } from "@/lib/session";
import { getUserGroupId } from "@/lib/getUserGroupId";

export type AuthorizedContext = {
  ok: true;
  db: DrizzleD1Database;
  userId: string;
  groupId: string;
};

export type AuthorizationFailure = {
  ok: false;
  response: NextResponse;
};

export type AuthorizationResult = AuthorizedContext | AuthorizationFailure;

/**
 * セッションからユーザを特定し、所属グループまで解決する。
 * 失敗時は呼び出し側がそのまま返せる NextResponse を返す。
 */
export const authorize = async (
  request: Request,
): Promise<AuthorizationResult> => {
  const userId = await getSessionUser(request);

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const { env } = getCloudflareContext();
  const db = drizzle(env.DB);

  try {
    const groupId = await getUserGroupId(db, userId);
    return { ok: true, db, userId, groupId };
  } catch (err) {
    if (err instanceof Error && err.message === "USER_HAS_NO_GROUP") {
      return {
        ok: false,
        response: NextResponse.json({ error: "no-group" }, { status: 403 }),
      };
    }
    throw err;
  }
};
