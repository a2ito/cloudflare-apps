/**
 * 英文の読み上げ。ブラウザの音声合成（Web Speech API）を使う。
 *
 * 外部の読み上げ API を使わないのは、端末の中で完結して料金も鍵も要らないため。
 * 声の質は端末によって違うが、発音とリズムを確かめる用途には足りる。
 */

/** 少しゆっくりめ。聞き取って真似しやすくするため */
const RATE = 0.9;

type VoiceLike = Pick<SpeechSynthesisVoice, "lang" | "localService" | "default">;

/**
 * 英語の声を選ぶ。アメリカ英語を優先し、端末内の声（オフラインでも速い）を先にする。
 * 英語の声が無ければ null（lang の指定だけでブラウザに任せる）。
 */
export function pickEnglishVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
	const score = (v: T) => {
		const lang = v.lang.toLowerCase().replace("_", "-");
		if (!lang.startsWith("en")) return -1;
		return (lang === "en-us" ? 4 : 0) + (v.localService ? 2 : 0) + (v.default ? 1 : 0);
	};
	const best = voices.toSorted((a, b) => score(b) - score(a))[0];
	return best && score(best) >= 0 ? best : null;
}

export function isSpeechSupported(): boolean {
	return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/** 読み上げる。前の読み上げが残っていれば止めてから読む（連打で重ならないように） */
export function speak(text: string): void {
	if (!isSpeechSupported()) return;
	const synth = window.speechSynthesis;
	synth.cancel();
	const utterance = new SpeechSynthesisUtterance(text);
	utterance.lang = "en-US";
	utterance.rate = RATE;
	const voice = pickEnglishVoice(synth.getVoices());
	if (voice) utterance.voice = voice;
	synth.speak(utterance);
}

export function stopSpeaking(): void {
	if (isSpeechSupported()) window.speechSynthesis.cancel();
}
