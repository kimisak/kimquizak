import type { Question, McqProgress } from "@/lib/types";

export const MCQ_MIN_OPTIONS = 2;
export const MCQ_MAX_OPTIONS = 12;

export function getMcqEditorOptions(options?: string[]) {
  if (!options?.length) return ["", "", "", ""];
  const result = options.slice(0, MCQ_MAX_OPTIONS);
  while (result.length < MCQ_MIN_OPTIONS) result.push("");
  return result;
}

export function getMcqCorrectIndexes(question: Pick<Question, "mcqCorrectIndexes" | "mcqCorrectIndex">): number[] {
  return question.mcqCorrectIndexes ?? (question.mcqCorrectIndex != null && question.mcqCorrectIndex >= 0 ? [question.mcqCorrectIndex] : []);
}

export function getMcqRequiredCorrect(question: Question) {
  return question.mcqRequiredCorrect ?? getMcqCorrectIndexes(question).length;
}

export function createMcqProgress(): McqProgress {
  return { found: [], eliminated: [], pointsByTeam: {}, finished: false };
}

export function createMcqOptionOrder(optionCount: number, random: () => number = Math.random) {
  const order = Array.from({ length: Math.max(0, optionCount) }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const target = Math.max(0, Math.min(index, Math.floor(random() * (index + 1))));
    [order[index], order[target]] = [order[target], order[index]];
  }
  if (order.length > 1 && order.every((value, index) => value === index)) {
    order.push(order.shift()!);
  }
  return order;
}

export function getMcqOptionOrder(question: Question, progress: McqProgress) {
  const optionCount = Math.min(question.mcqOptions?.length ?? 0, MCQ_MAX_OPTIONS);
  const naturalOrder = Array.from({ length: optionCount }, (_, index) => index);
  if (!question.mcqShuffleOptions) return naturalOrder;
  const stored = progress.optionOrder;
  return stored?.length === optionCount
    && new Set(stored).size === optionCount
    && stored.every(index => Number.isInteger(index) && index >= 0 && index < optionCount)
    ? stored
    : naturalOrder;
}

export function prepareMcqProgress(question: Question, progress: McqProgress, random: () => number = Math.random): McqProgress {
  if (!question.mcqShuffleOptions) return progress;
  const storedOrder = getMcqOptionOrder(question, progress);
  if (storedOrder === progress.optionOrder) return progress;
  return {
    ...progress,
    optionOrder: createMcqOptionOrder(Math.min(question.mcqOptions?.length ?? 0, MCQ_MAX_OPTIONS), random),
  };
}

export function getMcqPickPoints(question: Question, foundCount: number) {
  const required = getMcqRequiredCorrect(question);
  if (required < 1 || foundCount >= required) return 0;
  const total = Math.max(0, Math.round(question.points));
  // Cumulative rounding distributes the entire pool, even when it is indivisible.
  return Math.floor(total * (foundCount + 1) / required) - Math.floor(total * foundCount / required);
}

export function pickMcqOption(question: Question, previous: McqProgress, index: number, teamId: string) {
  if (previous.finished || !teamId || !Number.isInteger(index) || index < 0 || index >= (question.mcqOptions?.length ?? 0)
    || previous.found.includes(index) || previous.eliminated.includes(index)) return null;
  const correct = getMcqCorrectIndexes(question).includes(index);
  const points = correct ? getMcqPickPoints(question, previous.found.length) : 0;
  const found = correct ? [...previous.found, index] : previous.found;
  const progress: McqProgress = {
    ...previous,
    found,
    eliminated: correct ? previous.eliminated : [...previous.eliminated, index],
    pointsByTeam: correct ? { ...previous.pointsByTeam, [teamId]: (previous.pointsByTeam[teamId] ?? 0) + points } : previous.pointsByTeam,
    teamId,
    finished: found.length >= getMcqRequiredCorrect(question) || (!correct && question.mcqRotateOnMiss !== true),
    lastCorrect: correct,
  };
  return { progress, points, correct };
}
