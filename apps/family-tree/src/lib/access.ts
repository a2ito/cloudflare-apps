import { getDb, type Db } from "@/db";
import { getMembership } from "@/db/queries";
import type { Tree } from "@/db/schema";
import { type AppUser, requireUser } from "./auth";
import type { MemberRole } from "./constants";
import { idFromForm } from "./form";

export type TreeAccess = {
  user: AppUser;
  db: Db;
  tree: Tree;
  role: MemberRole;
};

/** メンバーでない・権限が足りないとき。画面では「見つからない」として扱う */
export class TreeAccessError extends Error {
  constructor(message = "家系図が見つからないか、操作する権限がありません") {
    super(message);
    this.name = "TreeAccessError";
  }
}

/**
 * ログイン中のユーザが家系図のメンバーかを確かめる。
 *
 * 持ち主しかできない操作（名前の変更・共有・削除）は need に "owner" を渡す。
 * 他人の家系図の ID を送られても、存在するかどうかを含めて何も教えない。
 */
export async function requireTreeAccess(
  treeId: number,
  need: MemberRole = "editor",
): Promise<TreeAccess> {
  const user = await requireUser();
  const db = await getDb();
  const membership = await getMembership(db, treeId, user.email);
  if (!membership) throw new TreeAccessError();
  if (need === "owner" && membership.role !== "owner")
    throw new TreeAccessError("この操作は家系図の持ち主しかできません");
  return { user, db, ...membership };
}

/**
 * サーバーアクション用。フォームの treeId を読んで権限を確かめる。
 * 権限が無いときは投げずに、画面に出すエラーを返す。
 */
export async function accessFromForm(
  formData: FormData,
  need: MemberRole = "editor",
): Promise<{ access: TreeAccess } | { error: string }> {
  const treeId = idFromForm.safeParse(formData.get("treeId"));
  if (!treeId.success) return { error: "家系図の ID が不正です" };
  try {
    return { access: await requireTreeAccess(treeId.data, need) };
  } catch (error) {
    if (error instanceof TreeAccessError) return { error: error.message };
    throw error;
  }
}
