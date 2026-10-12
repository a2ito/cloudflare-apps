"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { createSentences, deleteSentence, updateSentence } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { parseBulk } from "@/lib/bulk";
import { today } from "@/lib/date";
import { type ActionState, idFromForm, parseForm } from "@/lib/form";
import { MAX_NOTE, MAX_SENTENCE } from "@/lib/limits";

const sentenceSchema = z.object({
	deckId: idFromForm,
	ja: z.string().trim().min(1, "日本文を入力してください").max(MAX_SENTENCE, `日本文は ${MAX_SENTENCE} 文字までです`),
	en: z.string().trim().min(1, "英文を入力してください").max(MAX_SENTENCE, `英文は ${MAX_SENTENCE} 文字までです`),
	note: z
		.string()
		.trim()
		.max(MAX_NOTE, `メモは ${MAX_NOTE} 文字までです`)
		.transform((s) => (s === "" ? null : s))
		.optional(),
});

export async function addSentence(_prev: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const parsed = parseForm(sentenceSchema, formData);
	if (!parsed.ok) return { error: parsed.error };

	const { deckId, ...input } = parsed.data;
	const db = await getDb();
	if ((await createSentences(db, user.id, deckId, [input], today())) === 0) return { error: "セットが見つかりません" };
	revalidatePath(`/decks/${deckId}`);
	return { success: "登録しました" };
}

export async function addSentencesBulk(_prev: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const parsed = parseForm(z.object({ deckId: idFromForm, text: z.string() }), formData);
	if (!parsed.ok) return { error: parsed.error };
	const bulk = parseBulk(parsed.data.text);
	if (!bulk.ok) return { error: bulk.error };

	const db = await getDb();
	const count = await createSentences(db, user.id, parsed.data.deckId, bulk.pairs, today());
	if (count === 0) return { error: "セットが見つかりません" };
	revalidatePath(`/decks/${parsed.data.deckId}`);
	return { success: `${count} 文を登録しました` };
}

export async function updateSentenceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const parsed = parseForm(sentenceSchema.extend({ id: idFromForm }), formData);
	if (!parsed.ok) return { error: parsed.error };

	const { id, ...input } = parsed.data;
	const db = await getDb();
	if (!(await updateSentence(db, user.id, id, input))) return { error: "文かセットが見つかりません" };
	revalidatePath(`/decks/${input.deckId}`);
	redirect(`/decks/${input.deckId}`);
}

export async function deleteSentenceAction(formData: FormData): Promise<void> {
	const user = await requireUser();
	const parsed = z.object({ id: idFromForm, deckId: idFromForm }).safeParse(Object.fromEntries(formData));
	if (!parsed.success) throw new Error("ID が不正です");

	const db = await getDb();
	await deleteSentence(db, user.id, parsed.data.id);
	revalidatePath(`/decks/${parsed.data.deckId}`);
}
