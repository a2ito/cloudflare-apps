import {
  QUESTIONS,
  Question,
} from "@/games/english-vocabulary-quiz/data/questions";

export function pickRandomQuestions(count: number): Question[] {
  return [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, count);
}

export function calculateScore(
  questions: Question[],
  answers: Record<string, string>,
): number {
  return questions.filter((q) => answers[q.id] === q.answer).length;
}
