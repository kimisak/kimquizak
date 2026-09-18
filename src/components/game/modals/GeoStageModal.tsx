'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Question } from "@/lib/types";
import { distanceBetweenKm, getGeoStageBands, getGeoStageScore, parseStreetViewSource } from "@/lib/geoguesser";
import { StreetViewPanorama } from "@/components/game/StreetViewPanorama";
import { GeoGuessMap, type GeoPoint } from "./GeoGuessMap";
import { QuestionModalHeader } from "./QuestionModalHeader";

type Phase = "waiting" | "exploring" | "map-loading" | "guessing" | "locked";

type Props = {
  question: Question;
  currentTeamName?: string;
  currentTeamColor?: string;
  currentTeamEmoji?: string | null;
  answeringTeamName?: string;
  answeringTeamColor?: string;
  answeringTeamEmoji?: string | null;
  showAnswer: boolean;
  onRevealAnswer: () => void;
  onFinish: (points: number, distanceKm: number | null) => void;
  disableActions?: boolean;
};

function seconds(value: number | null | undefined, fallback: number): number {
  return Math.max(5, Math.min(180, Number.isFinite(value) ? Number(value) : fallback));
}

function displayDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000).toLocaleString()} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}

export function GeoStageModal({
  question, currentTeamName, currentTeamColor, currentTeamEmoji,
  answeringTeamName, answeringTeamColor, answeringTeamEmoji,
  showAnswer, onRevealAnswer, onFinish, disableActions,
}: Props) {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [panoramaReady, setPanoramaReady] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [guess, setGuess] = useState<GeoPoint | null>(null);
  const deadlineRef = useRef(0);
  const answer = useMemo(() => parseStreetViewSource(question.mapEmbedUrl), [question.mapEmbedUrl]);
  const exploreSeconds = seconds(question.geoStageExploreSeconds, 30);
  const guessSeconds = seconds(question.geoStageGuessSeconds, 30);
  const distanceKm = answer && guess ? distanceBetweenKm(answer, guess) : null;
  const points = getGeoStageScore(question.points, distanceKm, getGeoStageBands(question.geoStageDistanceBandsKm));
  const showingMap = phase === "map-loading" || phase === "guessing" || phase === "locked";

  useEffect(() => {
    if (phase !== "exploring" && phase !== "guessing") return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setPhase((current) => current === "exploring" ? "map-loading" : current === "guessing" ? "locked" : current);
    };
    tick();
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
  }, [phase]);

  const startExploring = () => {
    if (!panoramaReady || phase !== "waiting") return;
    deadlineRef.current = Date.now() + exploreSeconds * 1000;
    setRemaining(exploreSeconds);
    setPhase("exploring");
  };

  const handleMapReady = useCallback(() => {
    if (phase !== "map-loading") return;
    deadlineRef.current = Date.now() + guessSeconds * 1000;
    setRemaining(guessSeconds);
    setPhase("guessing");
  }, [phase, guessSeconds]);

  const placeGuess = useCallback((point: GeoPoint) => {
    if (phase === "guessing" && Date.now() < deadlineRef.current) setGuess(point);
  }, [phase]);

  const phaseLabel = phase === "waiting" ? "Ready for the player"
    : phase === "exploring" ? "Explore the street"
    : phase === "map-loading" ? "Opening the map"
    : phase === "guessing" ? "Place your pin"
    : showAnswer ? "The result" : "Guess locked";

  return (
    <article className="card round-stage round-geo question-modal-card geo-question-modal geo-stage-modal">
      <QuestionModalHeader
        category={question.category}
        typeLabel="Pin the Globe"
        points={showAnswer ? points : question.points}
        teamName={answeringTeamName || currentTeamName}
        teamColor={answeringTeamName ? answeringTeamColor : currentTeamColor}
        teamEmoji={answeringTeamName ? answeringTeamEmoji : currentTeamEmoji}
        teamLabel={showAnswer ? "Answered by" : answeringTeamName ? "Answering" : "Current team"}
      />
      <div className={`geo-stage-body${phase !== "waiting" ? " with-narrative" : ""}`}>
        <div className="geo-stage-heading">
          <div>
            <span className="question-modal-eyebrow">{phase === "waiting" ? "One player on stage" : phase === "exploring" ? "Phase 1 of 2" : "Phase 2 of 2"}</span>
            <h1>{showAnswer ? question.answer || "The answer" : question.prompt || phaseLabel}</h1>
          </div>
          {phase !== "waiting" && <div className="geo-exploration-status exploring" role="status">
            <span aria-hidden>{showingMap ? "◎" : "⌖"}</span>
            <strong>{phaseLabel}</strong>
            {(phase === "exploring" || phase === "guessing") && remaining !== null && <b>{remaining}s</b>}
          </div>}
        </div>
        <div className="geo-stage-visual">
          {!showingMap && <div className={`geo-stage-street${phase === "waiting" ? " preparing" : ""}`}>
            <StreetViewPanorama sourceUrl={question.mapEmbedUrl ?? ""} interaction={phase === "exploring" ? "explore" : "fixed"} allowZoom className="geo-stage-panorama" onReadyChange={setPanoramaReady} />
          </div>}
          {phase === "waiting" && <div className="geo-stage-curtain">
            <div className="geo-stage-intro">
              <strong>One player. <em>One place.</em></strong>
              <p>Invite one teammate to the screen. Press Start only when they are ready.</p>
            </div>
            <div className="geo-stage-route-panel">
              <ol className="geo-stage-route" aria-label="Challenge steps">
                <li>
                  <span className="geo-stage-route-number">01</span>
                  <span className="geo-stage-route-copy"><strong>Explore the scene</strong><small>Street View · move, turn &amp; zoom</small></span>
                  <span className="geo-stage-route-time">{exploreSeconds}<small>sec</small></span>
                </li>
                <li>
                  <span className="geo-stage-route-number">02</span>
                  <span className="geo-stage-route-copy"><strong>Pin the place</strong><small>World map · one final guess</small></span>
                  <span className="geo-stage-route-time">{guessSeconds}<small>sec</small></span>
                </li>
              </ol>
              <p className="geo-stage-route-footnote">The map clock locks the pin. The host reveals the distance.</p>
            </div>
          </div>}
          {showingMap && answer && <GeoGuessMap answer={answer} guess={guess} locked={phase !== "guessing"} revealed={showAnswer} onGuess={placeGuess} onReady={handleMapReady} />}
        </div>
        {phase !== "waiting" && <div className="geo-stage-narrative" role="status">
          {phase === "exploring" && "Look around, zoom, and move. The map will appear when time runs out."}
          {phase === "map-loading" && "Street View is over. The map-guess timer will start when the map is ready."}
          {phase === "guessing" && (guess ? "Pin placed. Click elsewhere to change it before time runs out." : "Click the map to place your pin. You can change it until the timer ends.")}
          {phase === "locked" && !showAnswer && (guess ? "Time is up. The pin is locked. Host: reveal when ready." : "Time is up. No pin was placed. Host: reveal when ready.")}
          {showAnswer && <strong>{guess && distanceKm !== null ? `The guess was ${displayDistance(distanceKm)} from the answer · ${points} pts` : "No pin placed · 0 pts"}</strong>}
        </div>}
      </div>
      <footer className="question-modal-actions geo-stage-actions">
        <span className="geo-stage-step-note" role="status">{phase === "waiting" ? panoramaReady ? "Street View is ready" : "Preparing Street View…" : showAnswer ? "The line shows straight-line distance, not driving distance." : phase === "locked" ? "The host controls the reveal." : `${exploreSeconds}s to explore · ${guessSeconds}s to guess`}</span>
        {phase === "waiting" && <button className="button question-reveal-answer" type="button" disabled={!panoramaReady} onClick={startExploring}>Start exploring</button>}
        {phase === "locked" && !showAnswer && <button className="button question-reveal-answer" type="button" onClick={onRevealAnswer}>Reveal location & distance</button>}
        {showAnswer && <button className="button question-score-correct" type="button" disabled={disableActions} onClick={() => onFinish(points, distanceKm)}>{points > 0 ? `Award ${points} pts & finish` : "Finish · 0 pts"}</button>}
      </footer>
    </article>
  );
}
