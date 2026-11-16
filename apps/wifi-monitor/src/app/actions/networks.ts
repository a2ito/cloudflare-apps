"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { renameNetwork } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { MAX_NETWORK_NAME_LENGTH } from "@/lib/limits";

export type RenameNetworkState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "saved"; name: string };

const inputSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z
    .string()
    .trim()
    .min(1, "名前を入力してください")
    .max(
      MAX_NETWORK_NAME_LENGTH,
      `名前は ${MAX_NETWORK_NAME_LENGTH} 文字以内で入力してください`,
    ),
});

/** ネットワークの表示名を変える（SSID はそのまま） */
export async function renameNetworkAction(
  _prev: RenameNetworkState,
  formData: FormData,
): Promise<RenameNetworkState> {
  const user = await requireUser();
  const parsed = inputSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? "入力が不正です",
    };
  }

  const db = await getDb();
  // 他人のネットワークの ID を送られても変えない
  if (!(await renameNetwork(db, user.id, parsed.data.id, parsed.data.name))) {
    return { status: "error", error: "ネットワークが見つかりません" };
  }
  revalidatePath("/");
  revalidatePath(`/networks/${parsed.data.id}`);
  return { status: "saved", name: parsed.data.name };
}
