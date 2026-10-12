"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { createDeck, deleteDeck, renameDeck } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { type ActionState, idFromForm, parseForm } from "@/lib/form";
import { MAX_DECK_NAME } from "@/lib/limits";

const nameSchema = z
	.string()
	.trim()
	.min(1, "セット名を入力してください")
	.max(MAX_DECK_NAME, `セット名は ${MAX_DECK_NAME} 文字までです`);

export async function addDeck(_prev: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const parsed = parseForm(z.object({ name: nameSchema }), formData);
	if (!parsed.ok) return { error: parsed.error };

	const db = await getDb();
	const deck = await createDeck(db, user.id, parsed.data.name);
	if (!deck) return { error: `「${parsed.data.name}」は既にあります` };
	revalidatePath("/");
	return { success: `「${deck.name}」を作りました` };
}

export async function renameDeckAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const parsed = parseForm(z.object({ id: idFromForm, name: nameSchema }), formData);
	if (!parsed.ok) return { error: parsed.error };

	const db = await getDb();
	if (!(await renameDeck(db, user.id, parsed.data.id, parsed.data.name))) {
		return { error: `「${parsed.data.name}」は既にあります` };
	}
	revalidatePath("/");
	revalidatePath(`/decks/${parsed.data.id}`);
	return { success: "名前を変えました" };
}

export async function deleteDeckAction(formData: FormData): Promise<void> {
	const user = await requireUser();
	const id = idFromForm.safeParse(formData.get("id"));
	if (!id.success) throw new Error("ID が不正です");

	const db = await getDb();
	await deleteDeck(db, user.id, id.data);
	revalidatePath("/");
	redirect("/");
}
