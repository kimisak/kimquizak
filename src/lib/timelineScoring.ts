export type TimelinePlacementOutcome = {
  teamId: string;
  correct: boolean;
};

export type TimelinePointAllocation = {
  teamId: string;
  correctCount: number;
  sharedMissCount: number;
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
  const sharedMissCounts = new Map(eligibleTeams.map((teamId) => [teamId, 0]));

  outcomes.forEach((outcome) => {
    if (outcome.correct) {
      rawPoints.set(outcome.teamId, (rawPoints.get(outcome.teamId) ?? 0) + eventShare);
      correctCounts.set(outcome.teamId, (correctCounts.get(outcome.teamId) ?? 0) + 1);
      return;
    }

    const recipients = eligibleTeams.filter((teamId) => teamId !== outcome.teamId);
    const actualRecipients = recipients.length > 0 ? recipients : [outcome.teamId];
    const sharedPoints = eventShare / actualRecipients.length;
    actualRecipients.forEach((teamId) => {
      rawPoints.set(teamId, (rawPoints.get(teamId) ?? 0) + sharedPoints);
      sharedMissCounts.set(teamId, (sharedMissCounts.get(teamId) ?? 0) + 1);
    });
  });

  const targetDistributed = Math.round(eventShare * outcomes.length);
  const allocations = eligibleTeams.map((teamId) => {
    const raw = rawPoints.get(teamId) ?? 0;
    return {
      teamId,
      correctCount: correctCounts.get(teamId) ?? 0,
      sharedMissCount: sharedMissCounts.get(teamId) ?? 0,
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
    sharedMissCount: allocation.sharedMissCount,
    points: allocation.points,
  }));
}
