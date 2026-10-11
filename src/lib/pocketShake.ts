export type GesturePoint = { x: number; y: number; time: number };
export type PocketShake = {
  extremeY: number; extremeX: number; direction: number;
  reversals: number; lastMovedAt: number;
};

// Principal-axis projection makes diagonal shakes behave like horizontal ones.
// The minor/major variance ratio separates narrow, wobbly shakes from loops.
export function getGestureShape(points: GesturePoint[]) {
  const count = Math.max(1, points.length);
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / count;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / count;
  let xx = 0, yy = 0, xy = 0;
  for (const point of points) {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    xx += dx * dx;
    yy += dy * dy;
    xy += dx * dy;
  }
  const spread = Math.hypot(xx - yy, 2 * xy);
  const major = (xx + yy + spread) / 2;
  const minor = Math.max(0, (xx + yy - spread) / 2);
  const angle = Math.atan2(2 * xy, xx - yy) / 2;
  return { axisX: Math.cos(angle), axisY: Math.sin(angle), roundness: major > 0 ? minor / major : 0 };
}

// Count deliberate vertical reversals directly. No pickup-height requirement,
// minimum shake duration, or dependence on the number of pointer samples.
export function trackPocketShake(previous: PocketShake | null, x: number, y: number, now: number) {
  const state: PocketShake = previous && now - previous.lastMovedAt < 1500
    ? { ...previous }
    : { extremeY: y, extremeX: x, direction: 0, reversals: 0, lastMovedAt: now };
  const distance = y - state.extremeY;
  const horizontal = Math.abs(x - state.extremeX);
  if (horizontal > Math.max(24, Math.abs(distance) * 0.85)) {
    return { state: { extremeY: y, extremeX: x, direction: 0, reversals: 0, lastMovedAt: now }, ready: false };
  }
  if (state.direction && Math.sign(distance) === state.direction) {
    state.extremeY = y;
    state.extremeX = x;
    state.lastMovedAt = now;
  } else if (Math.abs(distance) >= 12) {
    if (state.direction) state.reversals += 1;
    state.direction = Math.sign(distance);
    state.extremeY = y;
    state.extremeX = x;
    state.lastMovedAt = now;
  }
  return { state, ready: state.reversals >= 2 };
}
