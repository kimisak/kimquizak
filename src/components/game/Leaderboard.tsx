'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { PlayerBondKind, ScoreTransaction, Team } from "@/lib/types";
import { getTeamAccent, getTeamMarker } from "@/lib/teamPresentation";
import { normalizePlayerBondKind } from "@/lib/playerBonds";

type Props = {
  teams: Team[];
  onAdjust: (teamId: string, delta: number, reason?: string) => void;
  onSet: (teamId: string, value: number) => void;
  history?: ScoreTransaction[];
  onUndo?: (transactionId: string) => void;
  compact?: boolean;
  currentTeamId?: string;
  scoresHidden?: boolean;
  onToggleScores?: () => void;
};

type ActiveDrag = {
  playerId: string;
  homeTeamId: string;
  pointerId: number;
  element: HTMLLIElement;
  startX: number;
  startY: number;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  lastMoveAt: number;
  velocityX: number;
  velocityY: number;
  lastOrbitAngle: number | null;
  orbitAngle: number;
  isDizzy: boolean;
  origin: DOMRect;
  teammateRects: Map<string, { rect: DOMRect; index: number; teamId: string }>;
  collisions: Set<string>;
  removeListeners: () => void;
};

type TeamEffectKind = "beer" | "snow" | "confetti";
type PlayerEncounterKind = PlayerBondKind | "high-five";

const playgroundProps: Array<{ kind: TeamEffectKind; emoji: string; label: string }> = [
  { kind: "beer", emoji: "🍺", label: "Beer shower" },
  { kind: "snow", emoji: "❄️", label: "Snow flurry" },
  { kind: "confetti", emoji: "🎉", label: "Party burst" },
];

const playerTemperaments = ["bouncy", "cool", "shy", "dramatic"] as const;
const neutralMoods = ["🙂", "😌", "😐", "🤔", "🤓", "🧐", "😶", "😙", "🙃", "😴", "😊", "😗"] as const;
const scoreSuspenseMoods = ["😰", "😬", "🫣", "🤯", "😵‍💫", "😱", "🤞", "😶‍🌫️", "🫨", "😳", "🥶", "😈"] as const;
const PLAYER_LAUNCH_SPEED_THRESHOLD = 0.9;
const PLAYER_DROP_HEIGHT_THRESHOLD = 24;
const PLAYER_RELEASE_VELOCITY_DECAY_MS = 140;

const bondVisuals: Record<PlayerEncounterKind, { moods: readonly [string, string]; particles: readonly string[] }> = {
  sweethearts: { moods: ["😚", "🥰"], particles: ["💕", "❤️", "💖", "💗", "🫶", "💘", "❤️"] },
  engaged: { moods: ["😇", "😍"], particles: ["🍾", "🥂", "✨", "💍", "🥂", "🍾", "✨"] },
  married: { moods: ["🤗", "🥰"], particles: ["🥂", "💍", "💐", "🤍", "💝", "🥂", "💐"] },
  parents: { moods: ["🥹", "😴"], particles: ["👶", "🍼", "🧸", "💩", "👶", "🍼", "💛"] },
  "drinking-buddies": { moods: ["🥴", "🤪"], particles: ["🍻", "🍺", "🥂", "🍾", "🍻", "🍺", "🥂"] },
  "high-five": { moods: ["🙌", "🙌"], particles: ["✨", "✋", "💫", "🙌", "✨", "✋", "💥"] },
};

const getNeutralMood = (playerId: string) => {
  let hash = 2166136261;
  for (let index = 0; index < playerId.length; index += 1) {
    hash = Math.imul(hash ^ playerId.charCodeAt(index), 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  return neutralMoods[(hash >>> 0) % neutralMoods.length];
};

const getScoreSuspenseMood = (playerId: string) => {
  let hash = 5381;
  for (let index = 0; index < playerId.length; index += 1) {
    hash = Math.imul(hash, 33) ^ playerId.charCodeAt(index);
  }
  hash ^= hash >>> 15;
  return scoreSuspenseMoods[(hash >>> 0) % scoreSuspenseMoods.length];
};

const getPlayerTemperament = (playerId: string) => {
  let hash = 0;
  for (let index = 0; index < playerId.length; index += 1) {
    hash = (hash * 31 + playerId.charCodeAt(index)) | 0;
  }
  return playerTemperaments[Math.abs(hash) % playerTemperaments.length];
};

export function Leaderboard({ teams, onAdjust, onSet, history = [], onUndo, compact = false, currentTeamId, scoresHidden = false, onToggleScores }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const [toyDrag, setToyDrag] = useState<{ kind: TeamEffectKind; emoji: string; x: number; y: number; targetTeamId?: string } | null>(null);
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [angryPlayers, setAngryPlayers] = useState<Record<string, number>>({});
  const [travelMoods, setTravelMoods] = useState<Record<string, "nervous" | "dizzy" | "visiting" | "exhausted">>({});
  const playerElements = useRef(new Map<string, HTMLLIElement>());
  const activeDrag = useRef<ActiveDrag | null>(null);
  const angerTimers = useRef(new Map<string, number>());
  const returnAnimations = useRef(new Map<string, Animation>());
  const returnMoodTimers = useRef(new Map<string, number>());
  const [teamEffects, setTeamEffects] = useState<Record<string, { kind: TeamEffectKind; epoch: number; particleCount: number }>>({});
  const teamEffectTimers = useRef(new Map<string, number>());
  const effectEpoch = useRef(0);
  const toyDragCleanup = useRef<(() => void) | null>(null);
  const [teamVisits, setTeamVisits] = useState<Record<string, { visitorId: string; epoch: number }>>({});
  const visitTimers = useRef(new Map<string, number>());
  const teamElements = useRef(new Map<string, HTMLDivElement>());
  const [bondReactions, setBondReactions] = useState<Record<string, { kind: PlayerEncounterKind; epoch: number; role: "dragged" | "target" }>>({});
  const bondTimers = useRef(new Map<string, number>());
  const [spectatorReactions, setSpectatorReactions] = useState<Record<string, number>>({});
  const spectatorTimers = useRef(new Map<string, number>());

  useEffect(() => () => {
    activeDrag.current?.removeListeners();
    angerTimers.current.forEach((timer) => window.clearTimeout(timer));
    returnMoodTimers.current.forEach((timer) => window.clearTimeout(timer));
    returnAnimations.current.forEach((animation) => animation.cancel());
    teamEffectTimers.current.forEach((timer) => window.clearTimeout(timer));
    visitTimers.current.forEach((timer) => window.clearTimeout(timer));
    bondTimers.current.forEach((timer) => window.clearTimeout(timer));
    spectatorTimers.current.forEach((timer) => window.clearTimeout(timer));
    toyDragCleanup.current?.();
  }, []);

  const wakeSpectators = (teamId: string, excludedPlayerIds: string[]) => {
    const spectatorIds = teams.find((team) => team.id === teamId)?.players
      .filter((player) => player.name.trim() && !excludedPlayerIds.includes(player.id))
      .map((player) => player.id) ?? [];
    if (spectatorIds.length === 0) return;
    effectEpoch.current += 1;
    const epoch = effectEpoch.current;
    setSpectatorReactions((current) => {
      const next = { ...current };
      spectatorIds.forEach((playerId) => {
        next[playerId] = epoch;
      });
      return next;
    });
    spectatorIds.forEach((playerId) => {
      const oldTimer = spectatorTimers.current.get(playerId);
      if (oldTimer) window.clearTimeout(oldTimer);
      spectatorTimers.current.set(playerId, window.setTimeout(() => {
        setSpectatorReactions((current) => {
          if (current[playerId] !== epoch) return current;
          const next = { ...current };
          delete next[playerId];
          return next;
        });
        spectatorTimers.current.delete(playerId);
      }, 6200));
    });
  };

  const triggerTeamEffect = (teamId: string, kind: TeamEffectKind) => {
    if (!teams.some((team) => team.id === teamId)) return;
    effectEpoch.current += 1;
    const epoch = effectEpoch.current;
    const particleCount = kind === "confetti" ? 18 : 16;
    setTeamEffects((current) => {
      return { ...current, [teamId]: { kind, epoch, particleCount } };
    });
    const oldTimer = teamEffectTimers.current.get(teamId);
    if (oldTimer) window.clearTimeout(oldTimer);
    teamEffectTimers.current.set(teamId, window.setTimeout(() => {
      setTeamEffects((current) => {
        if (current[teamId]?.epoch !== epoch) return current;
        const next = { ...current };
        delete next[teamId];
        return next;
      });
      teamEffectTimers.current.delete(teamId);
    }, kind === "beer" ? 15000 : 10500));
  };

  const startToyDrag = (event: ReactPointerEvent<HTMLButtonElement>, kind: TeamEffectKind, emoji: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    toyDragCleanup.current?.();
    const pointerId = event.pointerId;
    const findTarget = (x: number, y: number) => teams.find((team) => {
      const rect = teamElements.current.get(team.id)?.getBoundingClientRect();
      return rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    })?.id;
    const move = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      pointerEvent.preventDefault();
      setToyDrag({
        kind,
        emoji,
        x: pointerEvent.clientX,
        y: pointerEvent.clientY,
        targetTeamId: findTarget(pointerEvent.clientX, pointerEvent.clientY),
      });
    };
    const finish = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      removeListeners();
      const targetTeamId = findTarget(pointerEvent.clientX, pointerEvent.clientY);
      setToyDrag(null);
      if (targetTeamId) triggerTeamEffect(targetTeamId, kind);
    };
    const removeListeners = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      if (toyDragCleanup.current === removeListeners) toyDragCleanup.current = null;
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    toyDragCleanup.current = removeListeners;
    setToyDrag({ kind, emoji, x: event.clientX, y: event.clientY, targetTeamId: findTarget(event.clientX, event.clientY) });
  };

  const triggerBondEncounter = (firstPlayerId: string, secondPlayerId: string, kind: PlayerEncounterKind) => {
    effectEpoch.current += 1;
    const epoch = effectEpoch.current;
    setBondReactions((current) => ({
      ...current,
      [firstPlayerId]: { kind, epoch, role: "dragged" },
      [secondPlayerId]: { kind, epoch, role: "target" },
    }));
    setTravelMoods((current) => {
      const next = { ...current };
      delete next[firstPlayerId];
      delete next[secondPlayerId];
      return next;
    });
    [firstPlayerId, secondPlayerId].forEach((playerId) => {
      const oldTimer = bondTimers.current.get(playerId);
      if (oldTimer) window.clearTimeout(oldTimer);
      bondTimers.current.set(playerId, window.setTimeout(() => {
        setBondReactions((current) => {
          if (current[playerId]?.epoch !== epoch) return current;
          const next = { ...current };
          delete next[playerId];
          return next;
        });
        bondTimers.current.delete(playerId);
      }, 8500));
    });
  };

  const findBondKind = (firstPlayerId: string, secondPlayerId: string) => {
    const players = teams.flatMap((team) => team.players);
    const firstPlayer = players.find((player) => player.id === firstPlayerId);
    const secondPlayer = players.find((player) => player.id === secondPlayerId);
    const storedKind = firstPlayer?.bonds?.find((bond) => bond.playerId === secondPlayerId)?.kind
      ?? (firstPlayer?.bond?.playerId === secondPlayerId ? firstPlayer.bond.kind : undefined)
      ?? secondPlayer?.bonds?.find((bond) => bond.playerId === firstPlayerId)?.kind
      ?? (secondPlayer?.bond?.playerId === firstPlayerId ? secondPlayer.bond.kind : undefined);
    return normalizePlayerBondKind(storedKind);
  };

  const angerTeammate = (playerId: string, draggedRect: DOMRect, targetIndex: number, showAnger = true) => {
    const target = playerElements.current.get(playerId);
    if (!target) return;

    if (showAnger) {
      setAngryPlayers((current) => ({ ...current, [playerId]: (current[playerId] ?? 0) + 1 }));
      const existingTimer = angerTimers.current.get(playerId);
      if (existingTimer) window.clearTimeout(existingTimer);
      angerTimers.current.set(playerId, window.setTimeout(() => {
        setAngryPlayers((current) => {
          const next = { ...current };
          delete next[playerId];
          return next;
        });
        angerTimers.current.delete(playerId);
      }, 8000));
    }

    const targetRect = target.getBoundingClientRect();
    const dx = targetRect.left + targetRect.width / 2 - (draggedRect.left + draggedRect.width / 2);
    const dy = targetRect.top + targetRect.height / 2 - (draggedRect.top + draggedRect.height / 2);
    const magnitude = Math.max(1, Math.hypot(dx, dy));
    const pushX = dx / magnitude * (showAnger ? 34 : 12);
    const pushY = dy / magnitude * (showAnger ? 20 : 7);
    const restingY = targetIndex % 2 === 0 ? -4 : 4;
    target.animate([
      { translate: `0 ${restingY}px`, rotate: "0deg" },
      { translate: `${pushX}px ${restingY + pushY}px`, rotate: `${pushX > 0 ? 8 : -8}deg`, offset: 0.28 },
      { translate: `${pushX * 0.34}px ${restingY + pushY * 0.2}px`, rotate: `${pushX > 0 ? -4 : 4}deg`, offset: 0.55 },
      { translate: `${pushX * -0.16}px ${restingY - pushY * 0.12}px`, rotate: `${pushX > 0 ? 2 : -2}deg`, offset: 0.78 },
      { translate: `0 ${restingY}px`, rotate: "0deg" },
    ], { duration: 680, easing: "cubic-bezier(.18,.84,.24,1)" });
  };

  const startPlayerDrag = (
    event: ReactPointerEvent<HTMLLIElement>,
    playerId: string,
    homeTeamId: string,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const element = event.currentTarget;
    const returningAnimation = returnAnimations.current.get(playerId);
    const visibleRect = returningAnimation ? element.getBoundingClientRect() : null;
    returningAnimation?.cancel();
    returnAnimations.current.delete(playerId);
    const origin = element.getBoundingClientRect();
    const initialX = visibleRect ? visibleRect.left - origin.left : 0;
    const initialY = visibleRect ? visibleRect.top - origin.top : 0;
    const teammateRects = new Map<string, { rect: DOMRect; index: number; teamId: string }>();
    teams.forEach((team) => {
      team.players.filter((player) => player.name.trim()).forEach((player, index) => {
        if (player.id === playerId) return;
        const playerElement = playerElements.current.get(player.id);
        if (playerElement) teammateRects.set(player.id, {
          rect: playerElement.getBoundingClientRect(),
          index,
          teamId: team.id,
        });
      });
    });
    const oldMoodTimer = returnMoodTimers.current.get(playerId);
    if (oldMoodTimer) window.clearTimeout(oldMoodTimer);
    returnMoodTimers.current.delete(playerId);
    setTravelMoods((current) => ({ ...current, [playerId]: "nervous" }));
    element.classList.add("is-dragging");
    element.style.setProperty("--drag-x", `${initialX}px`);
    element.style.setProperty("--drag-y", `${initialY}px`);
    element.setPointerCapture?.(event.pointerId);

    const move = (pointerEvent: PointerEvent) => movePlayerDrag(pointerEvent);
    const finish = (pointerEvent: PointerEvent) => finishPlayerDrag(
      pointerEvent.pointerId,
      pointerEvent.timeStamp,
      pointerEvent.clientX,
      pointerEvent.clientY,
    );
    const cancel = (pointerEvent: PointerEvent) => finishPlayerDrag(
      pointerEvent.pointerId,
      pointerEvent.timeStamp,
      pointerEvent.clientX,
      pointerEvent.clientY,
    );
    const removeListeners = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);

    activeDrag.current = {
      playerId,
      homeTeamId,
      pointerId: event.pointerId,
      element,
      startX: event.clientX - initialX,
      startY: event.clientY - initialY,
      x: initialX,
      y: initialY,
      lastX: initialX,
      lastY: initialY,
      lastMoveAt: event.timeStamp,
      velocityX: 0,
      velocityY: 0,
      lastOrbitAngle: null,
      orbitAngle: 0,
      isDizzy: false,
      origin,
      teammateRects,
      collisions: new Set(),
      removeListeners,
    };
    setDraggedPlayerId(playerId);
  };

  const movePlayerDrag = (event: PointerEvent) => {
    const drag = activeDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const x = event.clientX - drag.startX;
    const y = event.clientY - drag.startY;
    const now = event.timeStamp;
    const elapsed = Math.max(8, now - drag.lastMoveAt);
    // Weight the newest movement heavily so a quick final flick actually feels
    // stronger than a slow placement over the same distance.
    drag.velocityX = drag.velocityX * 0.28 + ((x - drag.lastX) / elapsed) * 0.72;
    drag.velocityY = drag.velocityY * 0.28 + ((y - drag.lastY) / elapsed) * 0.72;
    drag.lastX = x;
    drag.lastY = y;
    drag.lastMoveAt = now;
    drag.x = x;
    drag.y = y;
    const orbitRadius = Math.hypot(x, y);
    if (orbitRadius > 24) {
      const angle = Math.atan2(y, x);
      if (drag.lastOrbitAngle !== null) {
        let angleDelta = angle - drag.lastOrbitAngle;
        if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
        if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
        if (Math.abs(angleDelta) < 1.2) drag.orbitAngle += angleDelta;
        if (!drag.isDizzy && Math.abs(drag.orbitAngle) >= Math.PI * 1.55) {
          drag.isDizzy = true;
          setTravelMoods((current) => ({ ...current, [drag.playerId]: "dizzy" }));
        }
      }
      drag.lastOrbitAngle = angle;
    } else {
      drag.lastOrbitAngle = null;
    }
    drag.element.style.setProperty("--drag-x", `${x}px`);
    drag.element.style.setProperty("--drag-y", `${y}px`);
    drag.element.style.setProperty("--drag-rotate", `${Math.max(-7, Math.min(7, x / 24))}deg`);

    const draggedRect = new DOMRect(
      drag.origin.x + x,
      drag.origin.y + y,
      drag.origin.width,
      drag.origin.height,
    );
    const collisions = new Set<string>();
    drag.teammateRects.forEach(({ rect: targetRect, index: targetIndex, teamId: targetTeamId }, teammateId) => {
      const overlapX = Math.min(draggedRect.right, targetRect.right) - Math.max(draggedRect.left, targetRect.left);
      const overlapY = Math.min(draggedRect.bottom, targetRect.bottom) - Math.max(draggedRect.top, targetRect.top);
      const gapX = Math.max(0, Math.max(targetRect.left - draggedRect.right, draggedRect.left - targetRect.right));
      const gapY = Math.max(0, Math.max(targetRect.top - draggedRect.bottom, draggedRect.top - targetRect.bottom));
      const bondKind = findBondKind(drag.playerId, teammateId);
      const movedEnoughToMeet = Math.hypot(x, y) >= 10;
      const isContact = bondKind
        ? movedEnoughToMeet && gapX <= 10 && gapY <= 10
        : overlapX >= 8 && overlapY >= 8;
      if (!isContact) return;
      collisions.add(teammateId);
      if (!drag.collisions.has(teammateId)) {
        wakeSpectators(targetTeamId, [drag.playerId, teammateId]);
        if (bondKind) {
          triggerBondEncounter(drag.playerId, teammateId, bondKind);
          angerTeammate(teammateId, draggedRect, targetIndex, false);
        } else if (targetTeamId === drag.homeTeamId) {
          triggerBondEncounter(drag.playerId, teammateId, "high-five");
          angerTeammate(teammateId, draggedRect, targetIndex, false);
        } else {
          angerTeammate(teammateId, draggedRect, targetIndex);
        }
      }
    });
    drag.collisions = collisions;
  };

  const finishPlayerDrag = (
    pointerId: number,
    releasedAt: number,
    releaseClientX: number,
    releaseClientY: number,
  ) => {
    const drag = activeDrag.current;
    if (!drag || drag.pointerId !== pointerId) return;
    const releaseX = releaseClientX - drag.startX;
    const releaseY = releaseClientY - drag.startY;
    const finalMoveElapsed = releasedAt - drag.lastMoveAt;
    if (finalMoveElapsed > 0 && (releaseX !== drag.x || releaseY !== drag.y)) {
      const sampleElapsed = Math.max(4, finalMoveElapsed);
      drag.velocityX = drag.velocityX * 0.2 + ((releaseX - drag.x) / sampleElapsed) * 0.8;
      drag.velocityY = drag.velocityY * 0.2 + ((releaseY - drag.y) / sampleElapsed) * 0.8;
      drag.x = releaseX;
      drag.y = releaseY;
    }
    activeDrag.current = null;
    drag.removeListeners();
    setDraggedPlayerId(null);

    const element = drag.element;
    element.classList.remove("is-dragging");
    element.style.setProperty("--drag-x", "0px");
    element.style.setProperty("--drag-y", "0px");
    element.style.setProperty("--drag-rotate", "0deg");
    if (Math.hypot(drag.x, drag.y) < 4) {
      setTravelMoods((current) => {
        const next = { ...current };
        delete next[drag.playerId];
        return next;
      });
      return;
    }
    const releaseCenter = {
      x: drag.origin.left + drag.x + drag.origin.width / 2,
      y: drag.origin.top + drag.y + drag.origin.height / 2,
    };
    const nearestBondedPlayer = teams
      .flatMap((team) => team.players.map((player) => ({ player, teamId: team.id })))
      .map(({ player, teamId }) => {
        if (player.id === drag.playerId || !player.name.trim()) return null;
        const kind = findBondKind(drag.playerId, player.id);
        const rect = playerElements.current.get(player.id)?.getBoundingClientRect();
        if (!kind || !rect) return null;
        const distance = Math.hypot(
          releaseCenter.x - (rect.left + rect.width / 2),
          releaseCenter.y - (rect.top + rect.height / 2),
        );
        return distance <= 92 ? { playerId: player.id, teamId, kind, distance } : null;
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .sort((first, second) => first.distance - second.distance)[0];
    if (nearestBondedPlayer) {
      triggerBondEncounter(drag.playerId, nearestBondedPlayer.playerId, nearestBondedPlayer.kind);
      wakeSpectators(nearestBondedPlayer.teamId, [drag.playerId, nearestBondedPlayer.playerId]);
    }
    const visitedTeam = teams.find((team) => {
      if (team.id === drag.homeTeamId) return false;
      const row = teamElements.current.get(team.id)?.getBoundingClientRect();
      return row
        && releaseCenter.x >= row.left
        && releaseCenter.x <= row.right
        && releaseCenter.y >= row.top
        && releaseCenter.y <= row.bottom;
    });
    if (visitedTeam) {
      effectEpoch.current += 1;
      const epoch = effectEpoch.current;
      if (!drag.isDizzy) {
        setTravelMoods((current) => ({ ...current, [drag.playerId]: "visiting" }));
      }
      setTeamVisits((current) => ({ ...current, [visitedTeam.id]: { visitorId: drag.playerId, epoch } }));
      const oldVisitTimer = visitTimers.current.get(visitedTeam.id);
      if (oldVisitTimer) window.clearTimeout(oldVisitTimer);
      visitTimers.current.set(visitedTeam.id, window.setTimeout(() => {
        setTeamVisits((current) => {
          if (current[visitedTeam.id]?.epoch !== epoch) return current;
          const next = { ...current };
          delete next[visitedTeam.id];
          return next;
        });
        visitTimers.current.delete(visitedTeam.id);
      }, 5200));
    }
    const releaseDistance = Math.hypot(drag.x, drag.y);
    const releaseIdleTime = Math.max(0, releasedAt - drag.lastMoveAt);
    const releaseVelocityDecay = Math.max(0, 1 - releaseIdleTime / PLAYER_RELEASE_VELOCITY_DECAY_MS);
    const releaseVelocityX = drag.velocityX * releaseVelocityDecay;
    const releaseVelocityY = drag.velocityY * releaseVelocityDecay;
    const releaseSpeed = Math.hypot(releaseVelocityX, releaseVelocityY);
    const wasLaunched = releaseDistance >= 24 && releaseSpeed >= PLAYER_LAUNCH_SPEED_THRESHOLD;
    const wasDroppedFromAbove = drag.y <= -PLAYER_DROP_HEIGHT_THRESHOLD;
    const shouldFall = wasLaunched || wasDroppedFromAbove;
    if (!visitedTeam && !shouldFall) {
      // A normal reposition is not a throw. Return from every direction without
      // the exaggerated walk/fall sequence (especially for horizontal moves).
      const gentleDuration = Math.max(280, Math.min(700, 260 + releaseDistance * 1.05));
      const gentleReturn = element.animate([
        { transform: `translate3d(${drag.x}px,${drag.y}px,0) scale(1.035) rotate(${Math.max(-3, Math.min(3, drag.x / 38))}deg)` },
        { transform: `translate3d(${drag.x * 0.3}px,${drag.y * 0.3}px,0) scale(1.01) rotate(0deg)`, offset: 0.7 },
        { transform: "translate3d(0,0,0) scale(1) rotate(0deg)" },
      ], { duration: gentleDuration, easing: "cubic-bezier(.2,.78,.22,1)", fill: "both" });
      returnAnimations.current.set(drag.playerId, gentleReturn);
      if (drag.isDizzy) {
        const dizzyTimer = window.setTimeout(() => {
          setTravelMoods((current) => {
            const next = { ...current };
            delete next[drag.playerId];
            return next;
          });
          returnMoodTimers.current.delete(drag.playerId);
        }, 2200);
        returnMoodTimers.current.set(drag.playerId, dizzyTimer);
      } else {
        setTravelMoods((current) => {
          const next = { ...current };
          delete next[drag.playerId];
          return next;
        });
      }
      void gentleReturn.finished.then(() => {
        if (returnAnimations.current.get(drag.playerId) !== gentleReturn) return;
        gentleReturn.cancel();
        returnAnimations.current.delete(drag.playerId);
      }).catch(() => undefined);
      return;
    }
    const rowRect = visitedTeam
      ? teamElements.current.get(visitedTeam.id)?.getBoundingClientRect()
      : element.closest(".scoreboard-team")?.getBoundingClientRect();
    const launchFlightMs = Math.max(220, Math.min(620, 150 + releaseSpeed * 190));
    const maxHorizontalLaunch = Math.min(460, Math.max(210, window.innerWidth * 0.32));
    const launchTravelX = Math.max(
      -maxHorizontalLaunch,
      Math.min(maxHorizontalLaunch, releaseVelocityX * launchFlightMs * 0.62),
    );
    const projectedX = wasLaunched
      ? drag.x + launchTravelX
      : drag.x;
    const rowFloorY = rowRect ? rowRect.bottom - drag.origin.bottom - 8 : drag.y + 30;
    const projectedFall = Math.max(
      34,
      Math.min(190, 42 + releaseVelocityY * launchFlightMs * 0.34 + releaseSpeed * 24),
    );
    const groundY = shouldFall
      ? visitedTeam
        ? Math.max(rowFloorY, drag.y + 8)
        : Math.max(rowFloorY, drag.y + projectedFall)
      : drag.y;
    const homeDistance = Math.hypot(projectedX, groundY);
    const duration = visitedTeam
      ? Math.max(1450, Math.min(3400, 1050 + homeDistance * 3.2))
      : Math.max(1250, Math.min(3200, 900 + homeDistance * 3));
    const releaseRotation = Math.max(-11, Math.min(11, releaseVelocityX * 8 + drag.x / 30));
    const at = (progress: number, step: number) => {
      const remaining = 1 - progress;
      const x = projectedX * remaining;
      const y = groundY * remaining - Math.abs(Math.sin(progress * Math.PI * 8)) * 5;
      const rotation = step % 2 === 0 ? -4 : 4;
      return `translate3d(${x}px,${y}px,0) scale(1) rotate(${rotation}deg)`;
    };
    const launchArcHeight = Math.max(
      52,
      Math.min(170, 42 + releaseSpeed * 28 + Math.max(0, -releaseVelocityY) * 38),
    );
    const launchArcFrame = (progress: number, offset: number): Keyframe => {
      const x = drag.x + (projectedX - drag.x) * progress;
      const linearY = drag.y + (groundY - drag.y) * progress;
      const y = linearY - launchArcHeight * 4 * progress * (1 - progress);
      return {
        transform: `translate3d(${x}px,${y}px,0) scale(1.06) rotate(${releaseRotation * (.4 + progress * .6)}deg)`,
        offset,
        easing: "linear",
      };
    };
    const fallAndRecover: Keyframe[] = shouldFall ? [
      { transform: `translate3d(${drag.x}px,${drag.y}px,0) scale(1.06) rotate(${releaseRotation * 0.4}deg)`, offset: 0, easing: "cubic-bezier(.18,.62,.42,1)" },
      ...(wasLaunched ? [
        launchArcFrame(0.2, 0.034),
        launchArcFrame(0.4, 0.068),
        launchArcFrame(0.6, 0.102),
        launchArcFrame(0.8, 0.136),
      ] : []),
      { transform: `translate3d(${projectedX}px,${groundY}px,0) scale(1.08,.86) rotate(${releaseRotation}deg)`, offset: 0.17, easing: "cubic-bezier(.22,.78,.3,1)" },
      { transform: `translate3d(${projectedX}px,${groundY - 14}px,0) scale(.98,1.05) rotate(${releaseRotation * -0.45}deg)`, offset: 0.22, easing: "ease-out" },
      { transform: `translate3d(${projectedX}px,${groundY}px,0) scale(1.05,.91) rotate(${releaseRotation * 0.3}deg)`, offset: 0.27 },
      { transform: `translate3d(${projectedX}px,${groundY}px,0) scale(.94,1.06) rotate(-8deg)`, offset: 0.32 },
      { transform: `translate3d(${projectedX}px,${groundY}px,0) scale(1) rotate(0deg)`, offset: 0.38 },
    ] : [
      { transform: `translate3d(${drag.x}px,${drag.y}px,0) scale(1.035) rotate(${Math.max(-3, Math.min(3, drag.x / 38))}deg)`, offset: 0 },
      { transform: `translate3d(${drag.x}px,${drag.y}px,0) scale(1) rotate(0deg)`, offset: 0.38 },
    ];
    const visitPause: Keyframe[] = visitedTeam ? [
      { transform: `translate3d(${projectedX}px,${groundY - 2}px,0) scale(1) rotate(-3deg)`, offset: 0.46 },
      { transform: `translate3d(${projectedX}px,${groundY}px,0) scale(1) rotate(3deg)`, offset: 0.54 },
      { transform: `translate3d(${projectedX}px,${groundY}px,0) scale(1) rotate(0deg)`, offset: 0.6 },
    ] : [];
    const walkingHome: Keyframe[] = [
      { transform: at(0.18, 0), offset: visitedTeam ? 0.68 : 0.48 },
      { transform: at(0.36, 1), offset: visitedTeam ? 0.75 : 0.58 },
      { transform: at(0.54, 2), offset: visitedTeam ? 0.82 : 0.68 },
      { transform: at(0.7, 3), offset: visitedTeam ? 0.89 : 0.78 },
      { transform: at(0.84, 4), offset: visitedTeam ? 0.95 : 0.88 },
      { transform: "translate3d(0,0,0) scale(1) rotate(0deg)", offset: 1 },
    ];
    const animation = element.animate([
      ...fallAndRecover,
      ...visitPause,
      ...walkingHome,
    ], { duration, fill: "both" });
    returnAnimations.current.set(drag.playerId, animation);

    const moodTimer = window.setTimeout(() => {
      setTravelMoods((current) => ({ ...current, [drag.playerId]: "exhausted" }));
    }, drag.isDizzy
      ? Math.max(2200, duration * (visitedTeam ? 0.61 : 0.48))
      : duration * (visitedTeam ? 0.61 : 0.35));
    returnMoodTimers.current.set(drag.playerId, moodTimer);
    void animation.finished.then(() => {
      if (returnAnimations.current.get(drag.playerId) !== animation) return;
      animation.cancel();
      returnAnimations.current.delete(drag.playerId);
      returnMoodTimers.current.delete(drag.playerId);
      setTravelMoods((current) => {
        const next = { ...current };
        delete next[drag.playerId];
        return next;
      });
    }).catch(() => undefined);
  };

  const podiumMarkers = ["🥇", "🥈", "🥉"];
  const leadingMoods = ["🤩", "😎", "😊", "🫡"];
  const steadyMoods = ["😊", "🙂", "😌", "🤓"];
  const chasingMoods = ["🫡", "🤨", "😤", "😅"];
  const winningMoods = ["🥳", "😁", "🤩", "😎"];
  const setbackMoods = ["😮", "🫣", "😤", "😅"];
  const allScoresNeutral = scoresHidden || teams.every((team) => team.score === 0);

  return (
    <section className={`card scoreboard${compact ? " compact" : ""}`} style={{ padding: compact ? "12px" : "18px" }}>
      <div
        className="scoreboard-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
          gap: "10px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: compact ? "1.2rem" : undefined }}>{compact ? "Podium" : "Scores"}</h2>
        <div className="scoreboard-header-actions">
          {compact && (
            <div className="scoreboard-prop-bank" role="group" aria-label="Drag an emoji onto a podium team">
              {playgroundProps.map((prop) => (
                <button
                  key={prop.kind}
                  type="button"
                  title={`Drag ${prop.label} onto a team`}
                  aria-label={`Drag ${prop.label} onto a team`}
                  onPointerDown={(event) => startToyDrag(event, prop.kind, prop.emoji)}
                >
                  <span aria-hidden>{prop.emoji}</span>
                </button>
              ))}
            </div>
          )}
          <button
            className={`button ghost compact scoreboard-visibility-toggle${scoresHidden ? " active" : ""}`}
            type="button"
            aria-pressed={scoresHidden}
            onClick={() => {
              if (!scoresHidden) setShowHistory(false);
              onToggleScores?.();
            }}
            title={scoresHidden ? "Reveal the podium, score controls, and played-tile results" : "Hide standings and played-tile results"}
          >
            <span aria-hidden>{scoresHidden ? "👁" : "◉"}</span>
            {scoresHidden ? "Reveal scores" : "Hide scores"}
          </button>
          <button
            className="button ghost compact"
            type="button"
            onClick={() => {
              setShowHistory((value) => !value);
            }}
            disabled={scoresHidden}
          >
            {showHistory ? "Hide history" : `History${history.length ? ` (${history.length})` : ""}`}
          </button>
        </div>
      </div>
      {toyDrag && (
        <div
          className={`scoreboard-prop-drag${toyDrag.targetTeamId ? " has-target" : ""}`}
          style={{ left: toyDrag.x, top: toyDrag.y }}
          aria-hidden
        >
          {toyDrag.emoji}
        </div>
      )}
      {teams.length === 0 ? (
        <div style={{ color: "var(--muted)" }}>
          Add teams first in the Teams page.
        </div>
      ) : (
        <div className="scoreboard-list">
          {teams.map((team) => {
            const accent = getTeamAccent(team);
            const marker = getTeamMarker(team);
            const isCurrentTurn = team.id === currentTeamId;
            const namedPlayers = team.players.filter((player) => player.name.trim());
            const rank = allScoresNeutral
              ? 0
              : 1 + teams.filter((candidate) => candidate.score > team.score).length;
            const latestScore = allScoresNeutral
              ? undefined
              : history.find((entry) => entry.teamId === team.id);
            const moodSet = latestScore
              ? latestScore.delta > 0 ? winningMoods : setbackMoods
              : rank === 1 ? leadingMoods : rank === 2 ? steadyMoods : chasingMoods;
            const moodState = latestScore
              ? latestScore.delta > 0 ? "winning" : "setback"
              : rank === 1 ? "leading" : "steady";
            const teamEffect = teamEffects[team.id];
            const teamVisit = teamVisits[team.id];

            return (
              <div
                key={team.id}
                ref={(node) => {
                  if (node) teamElements.current.set(team.id, node);
                  else teamElements.current.delete(team.id);
                }}
                className={`card scoreboard-team${isCurrentTurn ? " current" : ""}${teamVisit ? " has-visitor" : ""}${toyDrag?.targetTeamId === team.id ? " is-prop-target" : ""}`}
                data-rank={rank}
                data-emoji-surface={accent.emojiSurface}
                style={{
                  "--team-accent": accent.onLight,
                  "--team-base": accent.base,
                  "--team-tint": accent.tint,
                  "--team-glow": accent.glow,
                } as CSSProperties}
              >
                {teamEffect && (
                  <div key={`${teamEffect.kind}-${teamEffect.epoch}`} className={`scoreboard-emoji-shower is-${teamEffect.kind}`} aria-hidden>
                    {Array.from({ length: teamEffect.particleCount }, (_, particleIndex) => (
                      <span
                        key={particleIndex}
                        style={{
                          "--beer-x": `${4 + ((particleIndex * 37) % 92)}%`,
                          "--beer-delay": `${(particleIndex % 9) * 0.16}s`,
                          "--beer-duration": `${2.45 + (particleIndex % 4) * 0.18}s`,
                          "--beer-spin": `${220 + (particleIndex % 5) * 72}deg`,
                        } as CSSProperties}
                      >
                        {teamEffect.kind === "beer"
                          ? particleIndex % 4 === 0 ? "🍻" : "🍺"
                          : teamEffect.kind === "snow"
                            ? particleIndex % 4 === 0 ? "🧊" : "❄️"
                            : particleIndex % 4 === 0 ? "🥳" : ["🎉", "✨", "🎊"][particleIndex % 3]}
                      </span>
                    ))}
                  </div>
                )}
      <div
        className="scoreboard-rank"
        role="img"
        aria-label={scoresHidden ? "Standing hidden" : rank === 0 ? "No ranking yet" : `Place ${rank}`}
        title={scoresHidden ? "Standing hidden" : rank === 0 ? "Scores are level at zero" : rank >= 4 ? `Place ${rank} · Better luck next round` : `Place ${rank}`}
        style={{
                    width: compact && rank === 1 ? "42px" : compact ? "36px" : "42px",
                    height: compact && rank === 1 ? "42px" : compact ? "36px" : "42px",
                    borderRadius: "12px",
                    background: `${accent.base}`,
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    color: "#f8fafc",
                    border: `1px solid ${accent.glow}55`,
                    boxShadow: `0 3px 10px ${accent.base}45`,
                  }}
      >
        <span aria-hidden="true">{scoresHidden ? "?" : rank === 0 ? "•" : podiumMarkers[rank - 1] ?? "🧻"}</span>
      </div>
              <div className="scoreboard-profile">
                <div className="scoreboard-identity">
                  <span
                    className="scoreboard-team-pill team-identity-surface"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: compact ? "4px 8px" : "6px 10px",
                      borderRadius: "999px",
                      background: `${accent.base}22`,
                      border: `2px solid ${accent.base}55`,
                      color: "#f8fafc",
                      fontWeight: 900,
                      letterSpacing: "0.01em",
                      boxShadow: `0 1px 6px ${accent.base}44`,
                    }}
                  >
                    <span className="scoreboard-team-emoji team-identity-emoji" aria-hidden>{marker}</span>
                    <span className="scoreboard-team-name">{team.name}</span>
                    {isCurrentTurn && <span className="turn-badge">TURN</span>}
                  </span>
                </div>
                {namedPlayers.length > 0 && (
                  <div className="scoreboard-player-cluster">
                    {compact ? (
                      <ul className="scoreboard-player-list" aria-label={`Players in ${team.name}`}>
                        {namedPlayers.map((player, playerIndex) => {
                          const travelMood = travelMoods[player.id];
                          const bondReaction = bondReactions[player.id];
                          const isSpectating = Boolean(spectatorReactions[player.id]);
                          const protectedTravelMood = travelMood === "nervous" || travelMood === "dizzy";
                          const activeMood = protectedTravelMood
                            ? travelMood
                            : bondReaction?.kind
                              ?? travelMood
                              ?? (angryPlayers[player.id]
                                ? "angry"
                                : teamVisit
                                  ? "suspicious"
                                  : isSpectating
                                    ? "watching"
                                  : teamEffect?.kind === "beer"
                                    ? "tipsy"
                                  : teamEffect?.kind === "snow"
                                    ? "cold"
                                    : teamEffect?.kind === "confetti"
                                      ? "partying"
                                      : scoresHidden ? "score-suspense" : moodState);
                          const bondVisual = bondReaction ? bondVisuals[bondReaction.kind] : null;
                          const moodEmoji = travelMood === "nervous"
                            ? "😬"
                            : travelMood === "dizzy"
                              ? "😵‍💫"
                              : bondVisual
                                ? bondVisual.moods[bondReaction?.role === "dragged" ? 0 : 1]
                                    : travelMood === "visiting"
                                      ? "👋"
                                      : travelMood === "exhausted"
                                        ? "😮‍💨"
                                        : angryPlayers[player.id]
                                          ? "😠"
                                          : teamVisit
                                            ? ["👀", "🤨", "😲", "😆"][playerIndex % 4]
                                            : isSpectating
                                              ? playerIndex % 2 ? "🤭" : "👀"
                                            : teamEffect?.kind === "beer"
                                              ? ["🥴", "😄", "😁", "🥳"][playerIndex % 4]
                                              : teamEffect?.kind === "snow"
                                                ? ["🥶", "🫨", "😬", "😮"][playerIndex % 4]
                                              : teamEffect?.kind === "confetti"
                                                  ? ["🥳", "🤩", "😁", "😄"][playerIndex % 4]
                                              : scoresHidden
                                                ? getScoreSuspenseMood(player.id)
                                              : allScoresNeutral
                                                ? getNeutralMood(player.id)
                                                : moodSet[playerIndex % moodSet.length];
                          return (
                            <li
                              key={player.id}
                              ref={(node) => {
                                if (node) playerElements.current.set(player.id, node);
                                else playerElements.current.delete(player.id);
                              }}
                              className={`scoreboard-player temperament-${getPlayerTemperament(player.id)}${teamEffect ? ` has-team-effect effect-${teamEffect.kind}` : ""}${bondReaction ? " has-bond-reaction" : ""}${isSpectating ? " is-witnessing" : ""} mood-${activeMood}${draggedPlayerId === player.id ? " is-dragging" : ""}`}
                              title={`${player.name.trim()} · drag to play`}
                              style={{
                                "--mood-delay": `${playerIndex * -0.85}s`,
                                "--drag-x": "0px",
                                "--drag-y": "0px",
                                "--drag-rotate": "0deg",
                              } as CSSProperties}
                              onPointerDown={(event) => startPlayerDrag(event, player.id, team.id)}
                            >
                              <span className="scoreboard-player-marker" aria-hidden>{marker}</span>
                              <span className="scoreboard-player-name">{player.name.trim()}</span>
                              <span className="scoreboard-player-mood" aria-hidden>{moodEmoji}</span>
                              {teamEffect && (
                                <span className={`scoreboard-player-prop is-${teamEffect.kind}`} aria-hidden>
                                  {teamEffect.kind === "beer" ? "🍺" : teamEffect.kind === "snow" ? "❄️" : "🎉"}
                                </span>
                              )}
                              {!travelMood
                                && !bondReaction
                                && !angryPlayers[player.id]
                                && !isSpectating
                                && !teamVisit
                                && !teamEffect
                                && playerIndex % 2 === 0
                                && playerIndex < namedPlayers.length - 1 && (
                                  <span
                                    className="scoreboard-player-chatter"
                                    style={{ "--chatter-delay": `${(playerIndex * 3.7) - 8}s` } as CSSProperties}
                                    aria-hidden
                                  >
                                    {["…", "psst", "ha!"][playerIndex % 3]}
                                  </span>
                                )}
                              {bondReaction && (
                                <span className={`scoreboard-player-bond-effects is-${bondReaction.kind}`} aria-hidden>
                                  {bondVisuals[bondReaction.kind].particles.map((particle, index) => (
                                    <i
                                      key={`${particle}-${index}`}
                                      style={{
                                        "--bond-left": `${12 + ((index * 19) % 78)}%`,
                                        "--bond-delay": `${index * -0.31}s`,
                                        "--bond-drift": `${[-13, 9, -6, 14, -10, 7, 12][index % 7]}px`,
                                        "--bond-rotate": `${[-18, 14, -9, 20, -14, 8, 17][index % 7]}deg`,
                                      } as CSSProperties}
                                    >
                                      {particle}
                                    </i>
                                  ))}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <span className="scoreboard-player-names">
                        {namedPlayers.map((player) => player.name.trim()).join(", ")}
                      </span>
                    )}
                  </div>
                )}
              </div>
                {scoresHidden ? (
                  <div className="scoreboard-controls scoreboard-controls-concealed" aria-label={`${team.name} score hidden; correction controls remain available`}>
                    <button className="button ghost compact" type="button" onClick={() => onAdjust(team.id, -100)} aria-label={`Subtract 100 hidden points from ${team.name}`}>−100</button>
                    <span className="scoreboard-controls-hidden"><span aria-hidden>✦</span> Score hidden</span>
                    <button className="button ghost compact" type="button" onClick={() => onAdjust(team.id, 100)} aria-label={`Add 100 hidden points to ${team.name}`}>+100</button>
                  </div>
                ) : <div className="scoreboard-controls" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginLeft: "auto", justifyContent: "flex-end" }}>
                  <button className="button ghost compact" type="button" onClick={() => onAdjust(team.id, -100)}>−100</button>
                  <div style={{ position: "relative" }}>
                    <input
                      key={`${team.id}-${team.score}`}
                      type="number"
                      defaultValue={team.score}
                      aria-label={`Set score for ${team.name}`}
                      onBlur={(event) => onSet(team.id, Number(event.target.value))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                      style={{
                        width: "116px",
                        padding: "7px 30px 7px 8px",
                        borderRadius: "10px",
                        border: `1px solid ${accent.base}80`,
                        background: "rgba(255,255,255,0.07)",
                        color: "#f8fafc",
                        textAlign: "right",
                        fontSize: compact && rank === 1 ? "1.45rem" : "1.2rem",
                        fontWeight: 900,
                      }}
                    />
                    <span style={{ position: "absolute", right: "7px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: "0.62rem", fontWeight: 800, pointerEvents: "none" }}>PTS</span>
                  </div>
                  <button className="button ghost compact" type="button" onClick={() => onAdjust(team.id, 100)}>+100</button>
                </div>}
              </div>
            );
          })}
        </div>
      )}
      {showHistory && !scoresHidden && (
        <div
          className="scoreboard-history"
          style={{
            margin: compact ? "14px auto 0" : "14px 0 0",
            maxWidth: compact ? "1280px" : undefined,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: "12px",
            display: "grid",
            gap: "8px",
          }}
        >
          <div className="scoreboard-history-intro" style={{ fontSize: "0.9rem" }}>
            Every automatic score and host correction is recorded. Undo reverses only that entry.
          </div>
          {history.length === 0 ? (
            <div className="scoreboard-history-empty">No score changes yet.</div>
          ) : (
            history.slice(0, 12).map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  padding: "9px 10px",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong>{entry.teamName}</strong>{" "}
                  <span style={{ color: entry.delta >= 0 ? "#6ee7b7" : "#fca5a5", fontWeight: 800 }}>
                    {entry.delta === 0 ? "0 pts" : `${entry.delta > 0 ? "+" : ""}${entry.delta}`}
                  </span>
                  <div className="scoreboard-history-reason" style={{ fontSize: "0.85rem", overflowWrap: "anywhere" }}>
                    {entry.reason}
                  </div>
                </div>
                <button
                  className="button ghost compact"
                  type="button"
                  onClick={() => onUndo?.(entry.id)}
                >
                  Undo
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
