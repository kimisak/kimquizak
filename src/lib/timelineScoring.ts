export type TimelinePlacementOutcome = {
  teamId: string;
  correct: boolean;
};

/** Misses go to the back, with their year and point share still unclaimed. */
export function advanceTimelineQueue<T>(queue: readonly T[], correct: boolean): T[] {
  if (!queue.length) return [];
  return correct ? queue.slice(1) : [...queue.slice(1), queue[0]];
}

export type TimelinePointAllocation = {
  teamId: string;
  correctCount: number;
  wrongCount: number;
  points: number;
};

export function allocateTimelinePoints(
  totalPoints: number,
  eventCount: number,
  outcomes: TimelinePlacementOutcome[],
  teamOrder: string[],
): TimelinePointAllocation[] {
  const safeTotal = Math.max(0, Math.round(totalPoints));
  const safeEventCount = Math.max(1, Math.round(eventCount));
  const eligibleTeams = Array.from(new Set([
    ...teamOrder.filter(Boolean),
    ...outcomes.map((outcome) => outcome.teamId).filter(Boolean),
  ]));
  const eventShare = safeTotal / safeEventCount;
  const rawPoints = new Map(eligibleTeams.map((teamId) => [teamId, 0]));
  const correctCounts = new Map(eligibleTeams.map((teamId) => [teamId, 0]));
  const wrongCounts = new Map(eligibleTeams.map((teamId) => [teamId, 0]));

  outcomes.forEach((outcome) => {
    if (outcome.correct) {
      rawPoints.set(outcome.teamId, (rawPoints.get(outcome.teamId) ?? 0) + eventShare);
      correctCounts.set(outcome.teamId, (correctCounts.get(outcome.teamId) ?? 0) + 1);
      return;
    }

    // Misses do not consume shares: the event returns to the queue until placed correctly.
    wrongCounts.set(outcome.teamId, (wrongCounts.get(outcome.teamId) ?? 0) + 1);
  });

  const targetDistributed = Math.round(eventShare * outcomes.filter(outcome => outcome.correct).length);
  const allocations = eligibleTeams.map((teamId) => {
    const raw = rawPoints.get(teamId) ?? 0;
    return {
      teamId,
      correctCount: correctCounts.get(teamId) ?? 0,
      wrongCount: wrongCounts.get(teamId) ?? 0,
      points: Math.floor(raw),
      remainder: raw - Math.floor(raw),
    };
  });
  let pointsToDistribute = targetDistributed - allocations.reduce((sum, allocation) => sum + allocation.points, 0);
  const orderIndex = new Map(eligibleTeams.map((teamId, index) => [teamId, index]));
  const remainderOrder = [...allocations].sort((first, second) =>
    second.remainder - first.remainder ||
    (orderIndex.get(first.teamId) ?? Number.MAX_SAFE_INTEGER) -
      (orderIndex.get(second.teamId) ?? Number.MAX_SAFE_INTEGER),
  );

  for (let index = 0; index < remainderOrder.length && pointsToDistribute > 0; index += 1) {
    remainderOrder[index].points += 1;
    pointsToDistribute -= 1;
  }

  return allocations.map((allocation) => ({
    teamId: allocation.teamId,
    correctCount: allocation.correctCount,
    wrongCount: allocation.wrongCount,
    points: allocation.points,
  }));
}
