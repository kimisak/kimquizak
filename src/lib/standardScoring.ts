import type { Question } from "./types";

export const STANDARD_MAX_ANSWERS = 12;

export function getStandardAnswerCount(question: Pick<Question, "standardAnswerCount">): number {
  const count = question.standardAnswerCount ?? 1;
  return Number.isInteger(count) && count >= 1 && count <= STANDARD_MAX_ANSWERS ? count : 1;
}

export function getStandardPoints(question: Pick<Question, "standardAnswerCount" | "points">, correctCount: number): number {
  const count = getStandardAnswerCount(question);
  if (!Number.isInteger(correctCount) || correctCount < 0 || correctCount > count) return 0;
  return Math.floor(Math.max(0, Math.round(question.points)) * correctCount / count);
}
