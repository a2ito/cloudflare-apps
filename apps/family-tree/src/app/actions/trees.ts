"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import {
  addMember,
  countMembers,
  createTree,
  deleteTree,
  normalizeEmail,
  removeEditor,
  renameTree,
} from "@/db/queries";
import { accessFromForm } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { MAX_MEMBERS_PER_TREE, MAX_TREE_NAME } from "@/lib/constants";
import { type ActionState, parseForm } from "@/lib/form";

const treeNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "家系図の名前を入力してください")
    .max(MAX_TREE_NAME, "家系図の名前が長すぎます"),
});

export async function createTreeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(treeNameSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const tree = await createTree(await getDb(), user.email, parsed.data.name);
  revalidatePath("/");
  redirect(`/trees/${tree.id}`);
}

export async function renameTreeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const r = await accessFromForm(formData, "owner");
  if ("error" in r) return { error: r.error };
  const parsed = parseForm(treeNameSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const { db, tree } = r.access;
  await renameTree(db, tree.id, parsed.data.name);
  revalidatePath("/");
  revalidatePath(`/trees/${tree.id}`, "layout");
  return { success: "名前を変えました" };
}

export async function deleteTreeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const r = await accessFromForm(formData, "owner");
  if ("error" in r) return { error: r.error };
  // 打ち間違いで消さないよう、家系図の名前をそのまま打ってもらう
  if (String(formData.get("confirm") ?? "").trim() !== r.access.tree.name)
    return { error: "確認のため、家系図の名前を正しく入力してください" };

  await deleteTree(r.access.db, r.access.tree.id);
  revalidatePath("/");
  redirect("/");
}

const memberSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email("メールアドレスの形式が正しくありません"))
    .transform(normalizeEmail),
});

export async function addMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const r = await accessFromForm(formData, "owner");
  if ("error" in r) return { error: r.error };
  const parsed = parseForm(memberSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const { db, tree } = r.access;
  if ((await countMembers(db, tree.id)) >= MAX_MEMBERS_PER_TREE)
    return { error: `共有できるのは ${MAX_MEMBERS_PER_TREE} 人までです` };
  const added = await addMember(db, tree.id, parsed.data.email);
  if (!added) return { error: "すでに共有しています" };

  revalidatePath(`/trees/${tree.id}/settings`);
  return { success: `${parsed.data.email} と共有しました` };
}

export async function removeMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const r = await accessFromForm(formData, "owner");
  if ("error" in r) return { error: r.error };
  const email = z.string().min(1).safeParse(formData.get("email"));
  if (!email.success) return { error: "メールアドレスが不正です" };

  const { db, tree } = r.access;
  // 持ち主は removeEditor では消えない（家系図を消すしかない）
  const removed = await removeEditor(db, tree.id, email.data);
  if (!removed) return { error: "外せるのは編集者だけです" };

  revalidatePath(`/trees/${tree.id}/settings`);
  return { success: `${normalizeEmail(email.data)} との共有をやめました` };
}
