'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as CANNON from "cannon-es";
import { getTeamAccent, getTeamMarker } from "@/lib/teamPresentation";
import type { ResolvedHostMessage, Team } from "@/lib/types";

type Selection = NonNullable<ResolvedHostMessage["randomSelections"]>[number];

type WheelCandidate = {
  id: string;
  value: string;
  team?: Team;
  teamId?: string;
  playerId?: string;
};

type Props = {
  selections: Selection[];
  teams: Team[];
  onSelectionsChange: (selections: Selection[]) => void;
  onFinish: () => void;
};

const TWO_PI = Math.PI * 2;
const FIXED_STEP = 1 / 120;
const WHEEL_PHYSICS_VERSION = 2;
const RELEASE_SAMPLE_WINDOW_MS = 110;
const MIN_RELEASE_VELOCITY = 0.65;
const MAX_RELEASE_VELOCITY = 20;

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

const NUMBER_WHEEL_COLORS = [
  { base: "#b72842", glow: "#fff0ad" },
  { base: "#176b58", glow: "#c9f2db" },
  { base: "#426fa3", glow: "#d8efff" },
  { base: "#7651a7", glow: "#eedcff" },
];

function candidateVisual(candidate: WheelCandidate, index: number) {
  if (candidate.team) {
    const accent = getTeamAccent(candidate.team);
    return { base: accent.base, glow: accent.glow, marker: getTeamMarker(candidate.team) };
  }
  const color = NUMBER_WHEEL_COLORS[index % NUMBER_WHEEL_COLORS.length];
  return { ...color, marker: null };
}

function candidatePool(selection: Selection, teams: Team[], previousSelections: Selection[]) {
  const usedTeamIds = new Set(previousSelections
    .filter((selection) => selection.kind === "team" && selection.physicsVersion === WHEEL_PHYSICS_VERSION)
    .map((selection) => selection.teamId));
  const usedPlayerIds = new Set(previousSelections
    .filter((selection) => selection.kind === "player" && selection.physicsVersion === WHEEL_PHYSICS_VERSION)
    .map((selection) => selection.playerId));

  if (selection.kind === "number") {
    return selection.candidates.map((value, index): WheelCandidate => ({
      id: `number-${index}-${value}`,
      value,
    }));
  }

  if (selection.kind === "team") {
    return teams
      .map((team, index): WheelCandidate => ({
        id: team.id,
        value: team.name.trim() || `Team ${index + 1}`,
        team,
        teamId: team.id,
      }))
      .filter((candidate) => !usedTeamIds.has(candidate.teamId));
  }

  return teams.flatMap((team) => team.players
    .filter((player) => player.name.trim() && !usedPlayerIds.has(player.id))
    .map((player): WheelCandidate => ({
      id: player.id,
      value: player.name.trim(),
      team,
      teamId: team.id,
      playerId: player.id,
    })));
}

function PhysicsWheelReveal({
  selection,
  candidates,
  onLaunch,
  onLanded,
  onComplete,
}: {
  selection: Selection;
  candidates: WheelCandidate[];
  onLaunch: (initialAngularVelocity: number, angularDeceleration: number, startAngle: number) => void;
  onLanded: (candidate: WheelCandidate, selectedIndex: number) => void;
  onComplete: () => void;
}) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const machineRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const completionRef = useRef(onComplete);
  const landedRef = useRef(onLanded);
  const launchRef = useRef(onLaunch);
  const candidatesRef = useRef(candidates);
  const storedLaunchRef = useRef({
    physicsVersion: selection.physicsVersion,
    velocity: selection.wheelInitialAngularVelocity,
    deceleration: selection.wheelAngularDeceleration,
    startAngle: selection.wheelStartAngle,
  });
  const [landedCandidate, setLandedCandidate] = useState<WheelCandidate | null>(null);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const [hasLaunched, setHasLaunched] = useState(Boolean(
    selection.physicsVersion === 1 && selection.wheelInitialAngularVelocity,
  ));
  const [spinHint, setSpinHint] = useState("Drag & release");
  const candidateCount = candidates.length;
  const sliceRadians = TWO_PI / candidateCount;
  const segmentColors = candidates.map((candidate, index) => candidateVisual(candidate, index).base);
  const wheelGradient = segmentColors.map((color, index) => {
    const start = index * 360 / candidateCount;
    const end = (index + 1) * 360 / candidateCount;
    const dark = index % 2 === 0 ? "#102a20" : "#081b14";
    return `color-mix(in srgb, ${color} 58%, ${dark}) ${start}deg ${end}deg`;
  }).join(",");

  useEffect(() => {
    completionRef.current = onComplete;
    landedRef.current = onLanded;
    launchRef.current = onLaunch;
  }, [onComplete, onLanded, onLaunch]);

  useEffect(() => {
    const wheel = wheelRef.current;
    const machine = machineRef.current;
    const pointer = pointerRef.current;
    if (!wheel || !machine || candidateCount === 0) return;

    let cancelled = false;
    let animationFrame = 0;
    let completionTimer = 0;
    let previousTime = performance.now();
    let accumulator = 0;
    let displayedAngle = storedLaunchRef.current.startAngle ?? -sliceRadians / 2;
    let previousBoundary = Math.floor(displayedAngle / sliceRadians);
    let displayedCandidateIndex = 0;
    let tickAudioIndex = 0;
    let launched = false;
    let dragging = false;
    let dragPointerId = -1;
    let previousPointerAngle = 0;
    let previousPointerTime = 0;
    let velocitySamples: Array<{ angle: number; time: number }> = [];
    let lastMoveTime = 0;
    let initialAngularVelocity = 0;
    let angularDeceleration = 0;

    const spinAudio = new Audio("/audio/wheel-spin-cc0.ogg");
    spinAudio.loop = true;
    spinAudio.volume = 0.22;
    spinAudio.playbackRate = 1.15;
    spinAudio.preload = "auto";
    const tickAudio = Array.from({ length: 5 }, () => {
      const audio = new Audio("/audio/wheel-tick-cc0.ogg");
      audio.preload = "auto";
      return audio;
    });

    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) });
    const body = new CANNON.Body({ mass: 16, angularDamping: 0 });
    body.addShape(new CANNON.Sphere(2.8));
    body.angularFactor.set(0, 0, 1);
    world.addBody(body);
    const inverseInertia = body.invInertia.z || 1;

    const playPegCollision = (velocity: number) => {
      const speed = Math.abs(velocity);
      if (pointer) {
        const collisionPeriod = sliceRadians / Math.max(speed, 0.1);
        const duration = Math.max(75, Math.min(270, collisionPeriod * 900));
        const direction = Math.sign(velocity) || 1;
        const deflection = direction * Math.max(8, Math.min(18, 7 + speed * 0.8));
        pointer.getAnimations().forEach((animation) => animation.cancel());
        pointer.animate(
          [
            { transform: "translateX(-50%) rotate(0deg)" },
            { transform: `translateX(-50%) rotate(${deflection}deg)`, offset: 0.34 },
            { transform: "translateX(-50%) rotate(-4deg)", offset: 0.72 },
            { transform: "translateX(-50%) rotate(0deg)" },
          ],
          { duration, easing: "ease-out" },
        );
      }

      const audio = tickAudio[tickAudioIndex % tickAudio.length];
      tickAudioIndex += 1;
      audio.pause();
      audio.currentTime = 0;
      audio.volume = Math.max(0.08, Math.min(0.2, 0.07 + speed * 0.009));
      audio.playbackRate = 0.94 + (tickAudioIndex % 3) * 0.04;
      void audio.play().catch(() => undefined);
    };

    const renderWheel = (velocity = 0) => {
      wheel.style.setProperty("--wheel-angle", `${displayedAngle}rad`);
      wheel.style.setProperty("--wheel-counter-angle", `${-displayedAngle}rad`);
      const pointerCandidateIndex = Math.min(
        candidateCount - 1,
        Math.floor(modulo(-displayedAngle, TWO_PI) / sliceRadians),
      );
      if (pointerCandidateIndex !== displayedCandidateIndex) {
        displayedCandidateIndex = pointerCandidateIndex;
        setActiveCandidateIndex(pointerCandidateIndex);
      }
      const currentBoundary = Math.floor(displayedAngle / sliceRadians);
      if (currentBoundary !== previousBoundary) {
        previousBoundary = currentBoundary;
        playPegCollision(velocity);
      }
    };

    const settle = () => {
      if (cancelled) return;
      body.angularVelocity.setZero();
      spinAudio.pause();
      const localPointerAngle = modulo(-displayedAngle, TWO_PI);
      const selectedIndex = Math.min(
        candidateCount - 1,
        Math.floor(localPointerAngle / sliceRadians),
      );
      const winner = candidatesRef.current[selectedIndex];
      setActiveCandidateIndex(selectedIndex);
      setLandedCandidate(winner);
      landedRef.current(winner, selectedIndex);
      completionTimer = window.setTimeout(() => completionRef.current(), 1550);
    };

    const animate = (time: number) => {
      if (cancelled || !launched) return;
      const frameTime = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      accumulator += frameTime;

      while (accumulator >= FIXED_STEP) {
        const velocityBeforeStep = body.angularVelocity.z;
        if (Math.abs(velocityBeforeStep) <= angularDeceleration * FIXED_STEP) {
          settle();
          return;
        }
        body.torque.set(
          0,
          0,
          -Math.sign(velocityBeforeStep) * angularDeceleration / inverseInertia,
        );
        world.step(FIXED_STEP);
        const velocityAfterStep = body.angularVelocity.z;
        displayedAngle += (velocityBeforeStep + velocityAfterStep) * 0.5 * FIXED_STEP;
        accumulator -= FIXED_STEP;
        renderWheel(velocityAfterStep);
      }

      const speedRatio = Math.min(1, Math.abs(body.angularVelocity.z / initialAngularVelocity));
      spinAudio.playbackRate = 0.62 + speedRatio * 0.68;
      spinAudio.volume = 0.07 + speedRatio * 0.15;
      animationFrame = window.requestAnimationFrame(animate);
    };

    const launch = (velocity: number, deceleration: number, startAngle: number, persist: boolean) => {
      if (launched || cancelled) return;
      launched = true;
      initialAngularVelocity = velocity;
      angularDeceleration = deceleration;
      displayedAngle = startAngle;
      body.angularVelocity.set(0, 0, velocity);
      machine.classList.add("spinning");
      if (persist) {
        setHasLaunched(true);
        launchRef.current(velocity, deceleration, startAngle);
      }
      previousTime = performance.now();
      accumulator = 0;
      void spinAudio.play().catch(() => undefined);
      animationFrame = window.requestAnimationFrame(animate);
    };

    const pointerAngle = (event: PointerEvent) => {
      const bounds = machine.getBoundingClientRect();
      return Math.atan2(
        event.clientY - (bounds.top + bounds.height / 2),
        event.clientX - (bounds.left + bounds.width / 2),
      );
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (launched || event.button !== 0) return;
      event.preventDefault();
      dragging = true;
      dragPointerId = event.pointerId;
      previousPointerAngle = pointerAngle(event);
      previousPointerTime = performance.now();
      lastMoveTime = previousPointerTime;
      velocitySamples = [{ angle: displayedAngle, time: previousPointerTime }];
      machine.classList.remove("needs-stronger-spin");
      machine.classList.add("dragging");
      setSpinHint("Release to spin");
      machine.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== dragPointerId) return;
      event.preventDefault();
      const now = performance.now();
      const nextPointerAngle = pointerAngle(event);
      let angleDelta = nextPointerAngle - previousPointerAngle;
      if (angleDelta > Math.PI) angleDelta -= TWO_PI;
      if (angleDelta < -Math.PI) angleDelta += TWO_PI;
      const elapsed = Math.max(0.008, (now - previousPointerTime) / 1000);
      const instantaneousVelocity = angleDelta / elapsed;
      displayedAngle += angleDelta;
      velocitySamples.push({ angle: displayedAngle, time: now });
      velocitySamples = velocitySamples.filter(({ time }) => now - time <= RELEASE_SAMPLE_WINDOW_MS);
      previousPointerAngle = nextPointerAngle;
      previousPointerTime = now;
      lastMoveTime = now;
      renderWheel(instantaneousVelocity);
    };

    const finishDrag = (event: PointerEvent, cancelledDrag = false) => {
      if (!dragging || event.pointerId !== dragPointerId) return;
      dragging = false;
      machine.classList.remove("dragging");
      if (machine.hasPointerCapture(event.pointerId)) machine.releasePointerCapture(event.pointerId);
      if (cancelledDrag) {
        setSpinHint("Drag & release");
        return;
      }

      const releaseTime = performance.now();
      const pauseBeforeRelease = releaseTime - lastMoveTime;
      const firstSample = velocitySamples[0];
      const lastSample = velocitySamples.at(-1);
      const sampleDuration = firstSample && lastSample
        ? (lastSample.time - firstSample.time) / 1000
        : 0;
      const measuredVelocity = firstSample && lastSample && sampleDuration > 0
        ? (lastSample.angle - firstSample.angle) / sampleDuration
        : 0;
      const releaseDecay = Math.max(0, 1 - pauseBeforeRelease / 140);
      const gestureVelocity = measuredVelocity * releaseDecay;
      if (Math.abs(gestureVelocity) < MIN_RELEASE_VELOCITY) {
        machine.classList.add("needs-stronger-spin");
        setSpinHint("Try a quicker throw");
        return;
      }

      const velocity = Math.sign(gestureVelocity)
        * Math.min(MAX_RELEASE_VELOCITY, Math.abs(gestureVelocity));
      const deceleration = 1.15 + Math.abs(velocity) * 0.08;
      launch(velocity, deceleration, displayedAngle, true);
    };

    const handlePointerCancel = (event: PointerEvent) => finishDrag(event, true);

    machine.addEventListener("pointerdown", handlePointerDown);
    machine.addEventListener("pointermove", handlePointerMove);
    machine.addEventListener("pointerup", finishDrag);
    machine.addEventListener("pointercancel", handlePointerCancel);
    animationFrame = window.requestAnimationFrame(() => renderWheel());

    const storedLaunch = storedLaunchRef.current;
    const storedVelocity = storedLaunch.velocity;
    const storedDeceleration = storedLaunch.deceleration;
    if (
      storedLaunch.physicsVersion === 1
      && storedVelocity
      && storedDeceleration
    ) {
      launch(storedVelocity, storedDeceleration, storedLaunch.startAngle ?? displayedAngle, false);
    }

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(completionTimer);
      pointer?.getAnimations().forEach((animation) => animation.cancel());
      spinAudio.pause();
      tickAudio.forEach((audio) => audio.pause());
      machine.removeEventListener("pointerdown", handlePointerDown);
      machine.removeEventListener("pointermove", handlePointerMove);
      machine.removeEventListener("pointerup", finishDrag);
      machine.removeEventListener("pointercancel", handlePointerCancel);
      world.removeBody(body);
    };
  }, [candidateCount, sliceRadians]);

  const densityClass = candidateCount > 12 ? " very-crowded" : candidateCount > 8 ? " crowded" : "";
  const activeCandidate = candidates[activeCandidateIndex] ?? candidates[0];
  const activeVisual = candidateVisual(activeCandidate, activeCandidateIndex);

  return (
    <div className={`random-wheel-stage${landedCandidate ? " settled" : ""}${densityClass}`}>
      <div className="random-wheel-live-readout" aria-hidden>
        <span
          key={activeCandidate.id}
          style={{
            "--readout-base": activeVisual.base,
            "--readout-color": activeVisual.glow,
          } as CSSProperties}
        >
          {activeVisual.marker && <b>{activeVisual.marker}</b>}
          <strong>{activeCandidate.value}</strong>
        </span>
      </div>
      <div
        className={`random-wheel-machine${hasLaunched ? " launched" : ""}`}
        ref={machineRef}
        aria-label={hasLaunched ? "Wheel spinning" : "Drag the wheel and release to spin"}
      >
        <div className="random-wheel-pointer" ref={pointerRef} aria-hidden><span /></div>
        <div className="random-wheel-frame">
        <span className="random-wheel-lights" aria-hidden>
          {Array.from({ length: 16 }, (_, index) => (
            <span
              className="random-wheel-light"
              key={index}
              style={{ "--light-angle": `${index * 22.5}deg` } as CSSProperties}
            />
          ))}
        </span>
        <div
          className="random-wheel"
          ref={wheelRef}
          style={{
            "--wheel-gradient": `conic-gradient(from 0deg,${wheelGradient})`,
            "--wheel-slice": `${360 / candidateCount}deg`,
            "--wheel-counter-angle": "0rad",
          } as CSSProperties}
          role="img"
          aria-label={`Spinning wheel with ${candidates.map(({ value }) => value).join(", ")}`}
        >
          {candidates.map((candidate, index) => {
            const visual = candidateVisual(candidate, index);
            return (
              <span
                className="random-wheel-label-spoke"
                key={candidate.id}
                style={{
                  "--segment-angle": `${(index + 0.5) * 360 / candidateCount}deg`,
                  "--label-counter-angle": `${-(index + 0.5) * 360 / candidateCount}deg`,
                  "--segment-color": visual.glow,
                } as CSSProperties}
              >
                <span className="random-wheel-label" title={candidate.value}>
                  <span className="random-wheel-label-content">
                    {visual.marker && <span aria-hidden>{visual.marker}</span>}
                    <strong>{candidate.value}</strong>
                  </span>
                </span>
              </span>
            );
          })}
          {candidates.map((candidate, index) => (
            <span
              className="random-wheel-peg-spoke"
              key={`peg-${candidate.id}`}
              style={{ "--segment-angle": `${index * 360 / candidateCount}deg` } as CSSProperties}
              aria-hidden
            >
              <span />
            </span>
          ))}
          <span className="random-wheel-rim" aria-hidden />
          <span className="random-wheel-hub" aria-hidden>
            {hasLaunched || landedCandidate ? (
              <b className="random-wheel-hub-star">✦</b>
            ) : (
              <>
                <b className="random-wheel-hub-arrow">↻</b>
                <small>{spinHint}</small>
              </>
            )}
          </span>
        </div>
      </div>
      </div>
    </div>
  );
}

export function RandomRevealSequence({
  selections,
  teams,
  onSelectionsChange,
  onFinish,
}: Props) {
  const firstUnresolvedIndex = selections.findIndex(
    (selection) => selection.physicsVersion !== WHEEL_PHYSICS_VERSION,
  );
  const [selectionIndex, setSelectionIndex] = useState(Math.max(0, firstUnresolvedIndex));
  const [liveSelections, setLiveSelections] = useState(selections);
  const selectionsRef = useRef(selections);
  const selection = liveSelections[selectionIndex];
  const candidates = useMemo(
    () => selection
      ? candidatePool(selection, teams, liveSelections.slice(0, selectionIndex))
      : [],
    [liveSelections, selection, selectionIndex, teams],
  );
  const candidateSignature = candidates.map((candidate) => (
    candidate.id
  )).join("|");

  const patchSelection = (updates: Partial<Selection>) => {
    const next = selectionsRef.current.map((current, index) => (
      index === selectionIndex ? { ...current, ...updates } : current
    ));
    selectionsRef.current = next;
    setLiveSelections(next);
    onSelectionsChange(next);
  };

  const completeSelection = () => {
    if (selectionIndex < liveSelections.length - 1) {
      setSelectionIndex((current) => current + 1);
    } else {
      onFinish();
    }
  };

  if (!selection || candidates.length === 0) return null;
  return (
    <section className="host-message-stage host-random-reveal-stage" aria-live="polite">
      <span className="host-message-kicker">Random selection</span>
      <span className="host-message-progress">Selection {selectionIndex + 1} of {liveSelections.length}</span>
      <h1 id="host-message-title">
        {selection.kind === "team"
          ? "Spin for a team"
          : selection.kind === "player"
            ? "Spin for a player"
            : "Spin for a number"}
      </h1>
      <PhysicsWheelReveal
        key={`${selectionIndex}-${candidateSignature}`}
        selection={selection}
        candidates={candidates}
        onLaunch={(wheelInitialAngularVelocity, wheelAngularDeceleration, wheelStartAngle) => {
          patchSelection({
            wheelInitialAngularVelocity,
            wheelAngularDeceleration,
            wheelStartAngle,
            physicsVersion: 1,
          });
        }}
        onLanded={(winner, selectedIndex) => {
          patchSelection({
            value: winner.value,
            candidates: candidates.map(({ value }) => value),
            candidateIds: candidates.map(({ teamId, playerId }) => ({ teamId, playerId })),
            selectedIndex,
            teamId: winner.teamId,
            playerId: winner.playerId,
            physicsVersion: WHEEL_PHYSICS_VERSION,
          });
        }}
        onComplete={completeSelection}
      />
      <p id="host-message-copy" className="host-random-reveal-wait">The host message follows.</p>
    </section>
  );
}
