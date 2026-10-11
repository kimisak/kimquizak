import type { Question } from "./types";

export type TriviaMarks = Record<string, string[]>;

export function getTriviaResults(question: Question, teamIds: string[], marks: TriviaMarks) {
  const items = question.triviaItems ?? [];
  return [...new Set(teamIds)].map(teamId => {
    const correct = items.filter(item => marks[item.id]?.includes(teamId)).length;
    return { teamId, correct, points: items.length ? Math.round(Math.max(0, question.points) * correct / items.length) : 0 };
  });
}

export function isTriviaReviewed(question: Question, reviewed: string[]) {
  const items = question.triviaItems ?? [];
  return items.length > 0 && items.every(item => reviewed.includes(item.id));
}
