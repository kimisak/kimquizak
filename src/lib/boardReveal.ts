import type { Question } from "@/lib/types";
import { isQuestionReady } from "@/lib/questionValidation";
import type { BoardRevealRule, BoardRevealRules } from "@/lib/settings";

export const OWN_CATEGORY = "__own_category__";

export function getQuestionRevealRules(
  question: Question,
  config?: BoardRevealRules,
  finalRowPoints?: number,
  finalCategoryPoints?: Map<string, number>,
): BoardRevealRule[] {
  const hasFinalRow = Boolean(finalRowPoints && config?.rows?.[String(finalRowPoints)]);
  const finalCategory = hasFinalRow ? undefined : Object.keys(config?.categories ?? {})[0];
  const questionRule = question.points === finalCategoryPoints?.get(question.category)
    ? config?.questions?.[question.id]
    : undefined;
  const normalizedQuestionRule: BoardRevealRule | undefined = questionRule?.when === "category-complete"
    ? { when: "category-complete", category: OWN_CATEGORY }
    : questionRule;
  const candidates: Array<BoardRevealRule | undefined> = [
    finalCategory === question.category ? { when: "board-complete" } : undefined,
    hasFinalRow && question.points === finalRowPoints ? { when: "board-complete" } : undefined,
    normalizedQuestionRule,
  ];
  return candidates.filter((rule): rule is BoardRevealRule => Boolean(rule));
}

/** Unlock checks use the original, non-hidden clues so a reveal cannot hide itself again. */
export function getVisibleBoardQuestions(questions: Question[], config?: BoardRevealRules): Question[] {
  const finalRowPoints = Math.max(0, ...questions.map((question) => question.points));
  const finalCategoryPoints = new Map<string, number>();
  questions.forEach((question) => finalCategoryPoints.set(
    question.category,
    Math.max(question.points, finalCategoryPoints.get(question.category) ?? 0),
  ));
  const openingQuestions = questions.filter((question) => getQuestionRevealRules(question, config, finalRowPoints, finalCategoryPoints).length === 0);
  const openingPlayable = openingQuestions.filter(isQuestionReady);
  const boardComplete = openingPlayable.length > 0 && openingPlayable.every((question) => question.answered);
  const categoryComplete = new Map<string, boolean>();

  for (const question of openingPlayable) {
    if (!categoryComplete.has(question.category)) categoryComplete.set(question.category, true);
    if (!question.answered) categoryComplete.set(question.category, false);
  }

  return questions.filter((question) => getQuestionRevealRules(question, config, finalRowPoints, finalCategoryPoints).every((rule) => {
    if (rule.when === "board-complete") return boardComplete;
    const source = rule.category === OWN_CATEGORY ? question.category : rule.category;
    return categoryComplete.get(source) === true;
  }));
}
