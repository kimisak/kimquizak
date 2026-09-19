export const JOKER_LEVEL_PERCENTAGES = [0.2, 0.25, 0.33, 0.44, 0.72, 1] as const;

export const JOKER_MIN_LEVEL = 1;
export const JOKER_MAX_LEVEL = JOKER_LEVEL_PERCENTAGES.length;

export function clampJokerLevel(level: number): number {
  return Math.min(JOKER_MAX_LEVEL, Math.max(JOKER_MIN_LEVEL, Math.round(level)));
}

export function getJokerLevelPoints(maximumReward: number, level: number): number {
  const safeReward = Math.max(0, Math.round(maximumReward));
  return Math.round(safeReward * JOKER_LEVEL_PERCENTAGES[clampJokerLevel(level) - 1]);
}

export function changeJokerLevel(level: number, correct: boolean): number {
  return clampJokerLevel(level + (correct ? 1 : -1));
}
