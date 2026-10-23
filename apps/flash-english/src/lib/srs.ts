/**
 * 出題の順番と、次に出す日の決め方（簡易な間隔反復）。
 *
 * ○が続いた文ほど間隔を空け、×の文はその日のうちにまた出す。
 * 苦手な文に時間を使い、覚えた文は忘れかけたころに確かめるため。
 */
import { shiftDate } from "./date";

/** 連続○の回数ごとの、次に出すまでの日数。1 回目の○で翌日、以降は伸びていく */
export const INTERVAL_DAYS = [1, 3, 7, 14, 30, 60] as const;

/** 1 回の練習で出す問題数 */
export const QUESTIONS_PER_SESSION = 10;

export type ReviewState = {
  streak: number;
  correctCount: number;
  wrongCount: number;
};

export type ReviewResult = ReviewState & {
  dueOn: string;
  lastReviewedOn: string;
};

/** ○×を付けたあとの状態 */
export function review(
  state: ReviewState,
  correct: boolean,
  today: string,
): ReviewResult {
  if (!correct) {
    return {
      streak: 0,
      correctCount: state.correctCount,
      wrongCount: state.wrongCount + 1,
      dueOn: today,
      lastReviewedOn: today,
    };
  }
  const streak = state.streak + 1;
  const days = INTERVAL_DAYS[Math.min(streak, INTERVAL_DAYS.length) - 1];
  return {
    streak,
    correctCount: state.correctCount + 1,
    wrongCount: state.wrongCount,
    dueOn: shiftDate(today, days),
    lastReviewedOn: today,
  };
}

export type Candidate = { id: number; dueOn: string; wrongCount: number };

/** 出す日を過ぎているか（今日が期限の文を含む） */
export function isDue(dueOn: string, today: string): boolean {
  return dueOn <= today;
}

/**
 * 出題する文を選ぶ。
 *
 * 期限を過ぎた文を先に、その中では×の多い順・期限の古い順に並べる。
 * 期限の文だけで足りなければ、期限の近い文で埋める（練習したいときに問題が無いと困るため）。
 */
export function pickQuestions<T extends Candidate>(
  candidates: readonly T[],
  today: string,
  limit: number = QUESTIONS_PER_SESSION,
): T[] {
  const due = candidates
    .filter((c) => isDue(c.dueOn, today))
    .toSorted(
      (a, b) =>
        b.wrongCount - a.wrongCount ||
        a.dueOn.localeCompare(b.dueOn) ||
        a.id - b.id,
    );
  const upcoming = candidates
    .filter((c) => !isDue(c.dueOn, today))
    .toSorted((a, b) => a.dueOn.localeCompare(b.dueOn) || a.id - b.id);
  return [...due, ...upcoming].slice(0, limit);
}
