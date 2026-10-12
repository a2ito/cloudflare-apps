import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv, type TestEnv } from "@/test/d1";
import {
	createDeck,
	createSentences,
	deleteDeck,
	deleteSentence,
	getSentence,
	listDecksWithStats,
	listPracticeCandidates,
	listSentences,
	recordReview,
	renameDeck,
	updateSentence,
	upsertUser,
} from "./queries";

let t: TestEnv;
let me: number;
let other: number;

beforeAll(async () => {
	t = await createTestEnv();
});
afterAll(() => t.dispose());
beforeEach(async () => {
	await t.truncate();
	me = (await upsertUser(t.db, { email: "me@example.com", name: null, image: null })).id;
	other = (await upsertUser(t.db, { email: "other@example.com", name: null, image: null })).id;
});

const today = "2026-10-12";

async function deckOf(userId: number, name: string) {
	const deck = await createDeck(t.db, userId, name);
	if (!deck) throw new Error("セットを作れなかった");
	return deck.id;
}

describe("decks", () => {
	it("名前順に、文の数と今日出す数を添えて返す。他人のセットは含まない", async () => {
		const b = await deckOf(me, "B");
		await deckOf(me, "A");
		await deckOf(other, "他人");
		await createSentences(t.db, me, b, [{ ja: "あ", en: "a" }, { ja: "い", en: "i" }], today);
		const [first] = await listSentences(t.db, me, b);
		await recordReview(t.db, me, first.id, true, today);

		expect(await listDecksWithStats(t.db, me, today)).toMatchObject([
			{ name: "A", total: 0, due: 0 },
			{ name: "B", total: 2, due: 1 },
		]);
	});

	it("同じ名前は作れないが、他人とは重なってよい", async () => {
		await deckOf(me, "章1");
		expect(await createDeck(t.db, me, "章1")).toBeNull();
		expect(await createDeck(t.db, other, "章1")).not.toBeNull();
	});

	it("名前を変える。既にある名前には変えられない", async () => {
		const a = await deckOf(me, "A");
		await deckOf(me, "B");
		expect(await renameDeck(t.db, me, a, "B")).toBe(false);
		expect(await renameDeck(t.db, me, a, "A")).toBe(true);
		expect(await renameDeck(t.db, me, a, "C")).toBe(true);
		expect((await listDecksWithStats(t.db, me, today)).map((d) => d.name)).toEqual(["B", "C"]);
	});

	it("消すと中の文も消える。他人のセットは消さない", async () => {
		const mine = await deckOf(me, "A");
		const theirs = await deckOf(other, "A");
		await createSentences(t.db, me, mine, [{ ja: "あ", en: "a" }], today);
		expect(await deleteDeck(t.db, me, theirs)).toBe(false);
		expect(await deleteDeck(t.db, me, mine)).toBe(true);
		expect(await listPracticeCandidates(t.db, me)).toEqual([]);
	});
});

describe("sentences", () => {
	it("まとめて足し、今日から出題の対象にする", async () => {
		const deck = await deckOf(me, "A");
		const inputs = Array.from({ length: 120 }, (_, i) => ({ ja: `日${i}`, en: `en${i}` }));
		expect(await createSentences(t.db, me, deck, inputs, today)).toBe(120);
		const rows = await listSentences(t.db, me, deck);
		expect(rows).toHaveLength(120);
		expect(rows[0]).toMatchObject({ ja: "日0", en: "en0", note: null, dueOn: today, streak: 0 });
	});

	it("他人のセットには足せない", async () => {
		const theirs = await deckOf(other, "A");
		expect(await createSentences(t.db, me, theirs, [{ ja: "あ", en: "a" }], today)).toBe(0);
		expect(await listSentences(t.db, other, theirs)).toEqual([]);
	});

	it("直して別のセットへ移せる。移し先が他人のセットなら直さない", async () => {
		const a = await deckOf(me, "A");
		const b = await deckOf(me, "B");
		const theirs = await deckOf(other, "X");
		await createSentences(t.db, me, a, [{ ja: "あ", en: "a" }], today);
		const [s] = await listSentences(t.db, me, a);

		expect(await updateSentence(t.db, me, s.id, { ja: "あ", en: "A", note: "大文字", deckId: theirs })).toBe(false);
		expect(await updateSentence(t.db, me, s.id, { ja: "あ", en: "A", note: "大文字", deckId: b })).toBe(true);
		expect(await getSentence(t.db, me, s.id)).toMatchObject({ en: "A", note: "大文字", deckId: b });
	});

	it("他人の文は読めず、直せず、消せない", async () => {
		const theirs = await deckOf(other, "A");
		await createSentences(t.db, other, theirs, [{ ja: "あ", en: "a" }], today);
		const [s] = await listSentences(t.db, other, theirs);
		const myDeck = await deckOf(me, "A");

		expect(await getSentence(t.db, me, s.id)).toBeNull();
		expect(await updateSentence(t.db, me, s.id, { ja: "x", en: "x", deckId: myDeck })).toBe(false);
		expect(await deleteSentence(t.db, me, s.id)).toBe(false);
		expect(await recordReview(t.db, me, s.id, true, today)).toBe(false);
		expect(await getSentence(t.db, other, s.id)).toMatchObject({ ja: "あ", streak: 0 });
	});
});

describe("practice", () => {
	it("候補はセットで絞れ、省くと自分の全セットから", async () => {
		const a = await deckOf(me, "A");
		const b = await deckOf(me, "B");
		const theirs = await deckOf(other, "A");
		await createSentences(t.db, me, a, [{ ja: "あ", en: "a" }], today);
		await createSentences(t.db, me, b, [{ ja: "い", en: "i" }], today);
		await createSentences(t.db, other, theirs, [{ ja: "う", en: "u" }], today);

		expect((await listPracticeCandidates(t.db, me, a)).map((s) => s.ja)).toEqual(["あ"]);
		expect((await listPracticeCandidates(t.db, me)).map((s) => s.ja).sort()).toEqual(["あ", "い"]);
	});

	it("○×を記録して次に出す日を決め直す", async () => {
		const deck = await deckOf(me, "A");
		await createSentences(t.db, me, deck, [{ ja: "あ", en: "a" }], today);
		const [s] = await listSentences(t.db, me, deck);

		await recordReview(t.db, me, s.id, true, today);
		expect(await getSentence(t.db, me, s.id)).toMatchObject({ streak: 1, correctCount: 1, dueOn: "2026-10-13", lastReviewedOn: today });
		await recordReview(t.db, me, s.id, false, "2026-10-13");
		expect(await getSentence(t.db, me, s.id)).toMatchObject({ streak: 0, wrongCount: 1, dueOn: "2026-10-13" });
	});
});
