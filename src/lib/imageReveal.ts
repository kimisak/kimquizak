import type { ImageRevealProgress, Question } from "./types";

export const IMAGE_REVEAL_STYLES = { zoom: "Zoom out", blur: "Clear the blur", areas: "Choose an area" } as const;
export const IMAGE_AREA_COLORS = ["#b89a58", "#819eae", "#a989ad", "#91aa70", "#be8570"];

/** Remove image-specific authoring state, retaining the question text and game rules. */
export function clearImageRevealImage(): Partial<Question> {
  return {
    imageData: null, imageName: null,
    imageRevealLevels: undefined, imageRevealStyleLevels: undefined,
    imageRevealPatchOverrides: undefined, imageRevealAreas: [],
    imageRevealOpeningCoverage: 0, imageRevealInitiallyVisible: [],
    imageRevealOpeningOverrides: {},
    imageRevealFocusX: undefined, imageRevealFocusY: undefined,
    imageRevealStageFocus: undefined, imageRevealFraming: undefined,
    imageRevealFillFrame: false,
    imageRevealAreaFrameAspect: undefined,
  };
}

export function getImageAreaOpeningTiles(question: Pick<Question, "id" | "imageRevealOpeningCoverage" | "imageRevealInitiallyVisible" | "imageRevealOpeningOverrides">): number[] {
  const value = question.imageRevealOpeningCoverage ?? 0;
  const coverage = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const visible = new Set([...getImageRevealOrder(`${question.id}:opening`, 384).slice(0, Math.round(384 * coverage / 100)), ...(question.imageRevealInitiallyVisible ?? []).filter(tile => Number.isInteger(tile) && tile >= 0 && tile < 384)]);
  // Manual decisions win over random coverage and legacy opening clues, never over an in-game area reveal.
  for (const [key, shown] of Object.entries(question.imageRevealOpeningOverrides ?? {})) {
    const tile = Number(key);
    if (!Number.isInteger(tile) || tile < 0 || tile >= 384) continue;
    if (shown === true) visible.add(tile);
    else if (shown === false) visible.delete(tile);
  }
  return [...visible];
}

/** Compatibility only: preserve opening clues, but leave area design to the host. */
export function migrateImageRevealQuestion(question: Question): Question {
  let next = question;
  if (question.imageRevealStyle === "noise") {
    const opening = getImageRevealVisiblePatches(question, 0);
    next = { ...question, imageRevealStyle: "areas", imageRevealOpeningCoverage: 0, imageRevealInitiallyVisible: opening, imageRevealAreas: [] };
  }
  const draft = next.typeDrafts?.imageReveal;
  if (draft?.imageRevealStyle === "noise") {
    const converted = migrateImageRevealQuestion({ ...draft, id: question.id, typeDrafts: undefined } as Question);
    const { id: _id, typeDrafts: _drafts, ...fields } = converted;
    void _id; void _drafts;
    next = { ...next, typeDrafts: { ...next.typeDrafts, imageReveal: fields } };
  }
  return next;
}

/** Cardinally connected islands; do not join opposite edges of adjacent rows. */
export function getImageAreaIslands(tiles: number[]): number[][] {
  const remaining = new Set(tiles.filter(tile => Number.isInteger(tile) && tile >= 0 && tile < 384));
  const islands: number[][] = [];
  while (remaining.size) {
    const first = remaining.values().next().value!;
    const island = [first]; remaining.delete(first);
    for (let index = 0; index < island.length; index++) {
      const tile = island[index];
      const adjacent = [tile - 24, tile + 24, ...(tile % 24 ? [tile - 1] : []), ...(tile % 24 < 23 ? [tile + 1] : [])];
      for (const next of adjacent) if (remaining.delete(next)) island.push(next);
    }
    islands.push(island);
  }
  return islands;
}

export function getImageRevealAreas(question: Pick<Question, "imageRevealAreas">): number[][] {
  if (!question.imageRevealAreas) return [];
  const assigned = new Set<number>();
  return question.imageRevealAreas.slice(0, 5).map(tiles => tiles.filter(tile => {
    if (!Number.isInteger(tile) || tile < 0 || tile >= 384 || assigned.has(tile)) return false;
    assigned.add(tile); return true;
  }));
}

/** A selection must uncover something: opening clues never consume an attempt. */
export function getImageAreaPlayableIndexes(question: Question): number[] {
  const opening = new Set(getImageAreaOpeningTiles(question));
  return getImageRevealAreas(question).flatMap((tiles, index) => tiles.some(tile => !opening.has(tile)) ? [index] : []);
}

/** Board tiers first, then evenly divide the lowest tier across remaining attempts. */
export function getImageAreaRewards(question: Question, boardValues: readonly number[]): number[] {
  const count = getImageAreaPlayableIndexes(question).length;
  if (question.imageRevealAreaMode !== "limited") return Array(count).fill(question.points);
  const candidates = [...new Set(boardValues.filter(value => Number.isInteger(value) && value > 0 && value < question.points))].sort((a, b) => b - a);
  const tiers = [question.points];
  // Imported tiny tiers must leave room for distinct positive rewards afterwards.
  for (const value of candidates) {
    if (tiers.length >= count) break;
    if (value >= count - tiers.length) tiers.push(value);
  }
  const floorIndex = tiers.length - 1;
  return Array.from({ length: count }, (_, index) => index < floorIndex
    ? tiers[index]
    : Math.max(1, Math.round(tiers[floorIndex] * (count - index) / (count - floorIndex))));
}

export function canGuessImageArea(question: Question, progress: ImageRevealProgress): boolean {
  if (progress.outcome || progress.answerRevealed) return false;
  const playable = getImageAreaPlayableIndexes(question);
  return playable.length > 0 && (progress.areaChosenThisTurn === true ||
    (question.imageRevealAreaMode !== "limited" && playable.every(area => progress.revealedAreas?.includes(area))));
}

export function chooseImageArea(question: Question, progress: ImageRevealProgress, area: number, boardValues: readonly number[], teamId?: string): ImageRevealProgress {
  if (!teamId || progress.outcome || progress.answerRevealed || progress.areaChosenThisTurn || progress.revealedAreas?.includes(area) || !getImageAreaPlayableIndexes(question).includes(area)) return progress;
  const revealed = progress.revealedAreas ?? [];
  const rewards = getImageAreaRewards(question, boardValues);
  if (question.imageRevealAreaMode === "limited" && revealed.length >= rewards.length) return progress;
  return { ...progress, points: rewards[revealed.length] ?? question.points, areaChosenThisTurn: true,
    revealedAreas: [...revealed, area], teamId: question.imageRevealAreaMode === "limited" ? progress.teamId ?? teamId : undefined };
}

export function missImageArea(question: Question, progress: ImageRevealProgress): ImageRevealProgress {
  if (!canGuessImageArea(question, progress)) return progress;
  const exhausted = question.imageRevealAreaMode === "limited" && (progress.revealedAreas?.length ?? 0) >= getImageAreaPlayableIndexes(question).length;
  return { ...progress, areaChosenThisTurn: false, answerRevealed: exhausted,
    ...(exhausted ? { outcome: "skipped" as const } : {}) };
}
export const IMAGE_REVEAL_MAX_ZOOM = 50;
export const IMAGE_REVEAL_MIN_DETAIL = 100 / IMAGE_REVEAL_MAX_ZOOM ** 2;

/** Editing one stage never rewrites neighbouring stages. */
export function setImageRevealLevel(levels: number[], index: number, value: number): number[] {
  const next = getImageRevealLevels(levels);
  if (index < 0 || index >= next.length) return next;
  next[index] = Math.max(IMAGE_REVEAL_MIN_DETAIL, Math.min(100, Math.round(value * 10000) / 10000));
  return next;
}

/** Translate the chosen opening crop to screen centre, then expand its bounds to the whole image. */
export function getImageRevealFrame(detail: number, openingDetail: number, focusX = 50, focusY = 50) {
  const openingSize = Math.sqrt(Math.max(IMAGE_REVEAL_MIN_DETAIL, Math.min(100, openingDetail)) / 100);
  const size = Math.max(openingSize, Math.sqrt(Math.max(IMAGE_REVEAL_MIN_DETAIL, Math.min(100, detail)) / 100));
  const openingLeft = (focus: number) => Math.max(0, Math.min(1 - openingSize, focus / 100 - openingSize / 2));
  const remaining = openingSize === 1 ? 0 : (1 - size) / (1 - openingSize);
  return { x: openingLeft(focusX) * remaining, y: openingLeft(focusY) * remaining, size, scale: 1 / size };
}

/** Drag deltas are fractions of the displayed image viewport, not of the source image. */
export function panImageRevealFrame(detail: number, focusX: number, focusY: number, dx: number, dy: number, visible = { x: 1, y: 1 }) {
  const frame = getImageRevealFrame(detail, detail, focusX, focusY);
  const center = (focus: number, delta: number, fraction: number) => {
    const half = frame.size * fraction / 2;
    const start = Math.max(half, Math.min(1 - half, focus / 100));
    return Math.max(half, Math.min(1 - half, start - delta * frame.size)) * 100;
  };
  return { x: center(focusX, dx, visible.x), y: center(focusY, dy, visible.y) };
}

/** Portion of the SVG viewBox visible when it fills a differently shaped frame. */
export function getImageRevealVisibleFractions(imageAspect: number, viewportAspect: number) {
  return { x: Math.min(1, viewportAspect / imageAspect), y: Math.min(1, imageAspect / viewportAspect) };
}

export function constrainImageRevealFrame(frame: ReturnType<typeof getImageRevealFrame>, visible: { x: number; y: number }) {
  const origin = (value: number, fraction: number) => {
    const half = frame.size * fraction / 2;
    return Math.max(half, Math.min(1 - half, value + frame.size / 2)) - frame.size / 2;
  };
  return { ...frame, x: origin(frame.x, visible.x), y: origin(frame.y, visible.y) };
}

/** Clamp each stage independently; the host decides the reveal sequence. */
export function getImageRevealLevels(levels?: number[]): number[] {
  const source = levels && levels.length >= 2 ? levels.slice(0, 5) : [8, 18, 35, 60, 100];
  return source.map((value) => {
    const safe = Number.isFinite(value) ? Math.round(value * 10000) / 10000 : IMAGE_REVEAL_MIN_DETAIL;
    return Math.max(IMAGE_REVEAL_MIN_DETAIL, Math.min(100, safe));
  });
}

type ImageFraming = Pick<Question, "imageRevealLevels" | "imageRevealFocusX" | "imageRevealFocusY" | "imageRevealStageFocus" | "imageRevealFillFrame">;

export function getImageRevealStageFrame(question: ImageFraming, stage: number) {
  const levels = getImageRevealLevels(question.imageRevealLevels);
  const index = Math.max(0, Math.min(levels.length - 1, stage));
  if (!question.imageRevealStageFocus) {
    // Existing quizzes keep their automatic pull-back until their framing is edited.
    return getImageRevealFrame(levels[index], levels[0], question.imageRevealFocusX, question.imageRevealFocusY);
  }
  let focus = { x: question.imageRevealFocusX ?? 50, y: question.imageRevealFocusY ?? 50 };
  for (let i = 0; i <= index; i++) focus = question.imageRevealStageFocus[i] ?? focus;
  if (question.imageRevealFillFrame) {
    const frame = getImageRevealFrame(levels[index], levels[index]);
    // The canvas knows the cropped viewport's aspect ratio and clamps these coordinates.
    return { ...frame, x: focus.x / 100 - frame.size / 2, y: focus.y / 100 - frame.size / 2 };
  }
  return getImageRevealFrame(levels[index], levels[index], focus.x, focus.y);
}

export function setImageRevealStageFocus(question: ImageFraming, stage: number, x: number, y: number) {
  const levels = getImageRevealLevels(question.imageRevealLevels);
  const next = Array.from({ length: levels.length }, (_, i) => question.imageRevealStageFocus?.[i] ?? null);
  if (stage < 0 || stage >= levels.length) return next;
  if (!question.imageRevealStageFocus) {
    // Preserve earlier legacy stages; subsequent unedited stages inherit this edit.
    for (let i = 0; i < stage; i++) {
      const frame = getImageRevealStageFrame(question, i);
      next[i] = { x: (frame.x + frame.size / 2) * 100, y: (frame.y + frame.size / 2) * 100 };
    }
  }
  next[stage] = { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  return next;
}

export function getImageRevealPoints(faceValue: number, step: number, boardValues: readonly number[], costsPoints: boolean): number {
  const tiers = [...new Set([faceValue, ...boardValues.filter(value => Number.isFinite(value) && value > 0 && value < faceValue)])].sort((a, b) => b - a);
  return costsPoints ? tiers[Math.min(tiers.length - 1, Math.max(0, Math.floor(step)))] : faceValue;
}

/** Seeded spatial order: preview, reopen and reload always uncover the same patches. */
export function getImageRevealOrder(seed: string, count: number): number[] {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = Math.floor((state / 4294967296) * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Each stage adds to prior reveals; overrides cannot hide a previously revealed tile. */
export function getImageRevealVisiblePatches(question: Pick<Question, "id" | "imageRevealLevels" | "imageRevealPatchOverrides">, stage: number): number[] {
  const levels = getImageRevealLevels(question.imageRevealLevels);
  const visible = new Set<number>();
  const order = getImageRevealOrder(question.id, 384);
  for (let index = 0; index <= Math.min(levels.length - 1, stage); index++) {
    const detail = levels[index];
    const additions = new Set(order.slice(0, detail <= IMAGE_REVEAL_MIN_DETAIL ? 0 : Math.ceil(384 * detail / 100)));
    for (const [key, shown] of Object.entries(question.imageRevealPatchOverrides?.[index] ?? {})) {
      const tile = Number(key);
      if (!Number.isInteger(tile) || tile < 0 || tile >= 384) continue;
      if (shown === true) additions.add(tile);
      else if (shown === false) additions.delete(tile);
    }
    for (const tile of additions) visible.add(tile);
  }
  return [...visible];
}
