/** The next lower value configured anywhere on the board, independent of row count or spacing. */
export function getAudioReplayValue(faceValue: number, boardValues: readonly number[]): number | null {
  const lowerValues = boardValues.filter((value) => Number.isFinite(value) && value >= 0 && value < faceValue);
  return lowerValues.length ? Math.max(...lowerValues) : null;
}

export function getAudioAvailablePoints(
  faceValue: number,
  playbackCount: number,
  boardValues: readonly number[],
  lockedReplayValue?: number,
): number {
  if (playbackCount < 2) return faceValue;
  return lockedReplayValue ?? getAudioReplayValue(faceValue, boardValues) ?? faceValue;
}
