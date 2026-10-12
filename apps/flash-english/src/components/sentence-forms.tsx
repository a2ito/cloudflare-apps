"use client";

import { useActionState, useEffect, useRef } from "react";
import { addSentence, addSentencesBulk, updateSentenceAction } from "@/app/actions/sentences";
import type { Deck, Sentence } from "@/db/schema";
import { initialActionState } from "@/lib/form";
import { MAX_NOTE, MAX_SENTENCE } from "@/lib/limits";
import { FormMessage } from "./form-message";
import { inputClass, primaryButtonClass } from "./ui";

function SentenceFields({ sentence }: { sentence?: Pick<Sentence, "ja" | "en" | "note"> }) {
	return (
		<>
			<label className="block space-y-1">
				<span className="text-sm text-zinc-500">日本文</span>
				<textarea name="ja" required maxLength={MAX_SENTENCE} rows={2} defaultValue={sentence?.ja} className={inputClass} />
			</label>
			<label className="block space-y-1">
				<span className="text-sm text-zinc-500">英文</span>
				<textarea name="en" required maxLength={MAX_SENTENCE} rows={2} defaultValue={sentence?.en} lang="en" className={inputClass} />
			</label>
			<label className="block space-y-1">
				<span className="text-sm text-zinc-500">メモ（任意。答えと一緒に出る）</span>
				<input name="note" maxLength={MAX_NOTE} defaultValue={sentence?.note ?? ""} className={inputClass} />
			</label>
		</>
	);
}

export function NewSentenceForm({ deckId }: { deckId: number }) {
	const [state, action, pending] = useActionState(addSentence, initialActionState);
	const formRef = useRef<HTMLFormElement>(null);

	// 続けて何文も入れるので、保存できたら欄を空にして日本文へ戻す
	useEffect(() => {
		if (!state.success) return;
		formRef.current?.reset();
		formRef.current?.querySelector<HTMLTextAreaElement>("textarea[name=ja]")?.focus();
	}, [state]);

	return (
		<form ref={formRef} action={action} className="space-y-3">
			<input type="hidden" name="deckId" value={deckId} />
			<SentenceFields />
			<button type="submit" disabled={pending} className={primaryButtonClass}>
				登録
			</button>
			<FormMessage state={state} />
		</form>
	);
}

export function BulkSentenceForm({ deckId }: { deckId: number }) {
	const [state, action, pending] = useActionState(addSentencesBulk, initialActionState);
	const formRef = useRef<HTMLFormElement>(null);

	useEffect(() => {
		if (state.success) formRef.current?.reset();
	}, [state]);

	return (
		<form ref={formRef} action={action} className="space-y-3">
			<input type="hidden" name="deckId" value={deckId} />
			<p className="text-sm text-zinc-500">
				1 行に「日本文 <kbd className="rounded border px-1 text-xs">Tab</kbd> 英文」。スプレッドシートの 2 列をコピーして貼り付けられます。
			</p>
			<textarea
				name="text"
				required
				rows={6}
				placeholder={"私は学生です。\tI am a student.\nこれはペンです。\tThis is a pen."}
				className={`${inputClass} font-mono text-sm`}
			/>
			<button type="submit" disabled={pending} className={primaryButtonClass}>
				まとめて登録
			</button>
			<FormMessage state={state} />
		</form>
	);
}

export function EditSentenceForm({ sentence, decks }: { sentence: Sentence; decks: Deck[] }) {
	const [state, action, pending] = useActionState(updateSentenceAction, initialActionState);

	return (
		<form action={action} className="space-y-3">
			<input type="hidden" name="id" value={sentence.id} />
			<label className="block space-y-1">
				<span className="text-sm text-zinc-500">セット</span>
				<select name="deckId" defaultValue={sentence.deckId} className={inputClass}>
					{decks.map((d) => (
						<option key={d.id} value={d.id}>
							{d.name}
						</option>
					))}
				</select>
			</label>
			<SentenceFields sentence={sentence} />
			<button type="submit" disabled={pending} className={primaryButtonClass}>
				保存
			</button>
			<FormMessage state={state} />
		</form>
	);
}
