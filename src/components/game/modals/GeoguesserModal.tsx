'use client';

import { useState } from "react";
import type { Question } from "@/lib/types";
import { getGeoExploreValue } from "@/lib/geoguesser";
import { StreetViewPanorama } from "@/components/game/StreetViewPanorama";
import { ExpandableImage } from "./ExpandableImage";
import { QuestionModalActions } from "./QuestionModalActions";
import { QuestionModalHeader } from "./QuestionModalHeader";
import { GeoStageModal } from "./GeoStageModal";

type Props = {
  question: Question;
  boardValues: readonly number[];
  currentTeamName?: string;
  currentTeamColor?: string;
  currentTeamEmoji?: string | null;
  answeringTeamName?: string;
  answeringTeamColor?: string;
  answeringTeamEmoji?: string | null;
  mapLocked: boolean;
  onToggleLock: () => void;
  onRevealAnswer: () => void;
  showAnswer: boolean;
  onCorrect: () => void;
  onWrong: () => void;
  disableActions?: boolean;
  countdownSeconds?: number | null;
  timerUsed?: boolean;
  potentialPoints?: number;
  onStageFinish?: (points: number, distanceKm: number | null) => void;
};

export function GeoguesserModal({
  question,
  boardValues,
  currentTeamName,
  currentTeamColor,
  currentTeamEmoji,
  answeringTeamName,
  answeringTeamColor,
  answeringTeamEmoji,
  mapLocked,
  onToggleLock,
  onRevealAnswer,
  showAnswer,
  onCorrect,
  onWrong,
  disableActions,
  countdownSeconds,
  timerUsed,
  potentialPoints,
  onStageFinish,
}: Props) {
  const duration = Math.max(3, Math.min(90, question.geoTimerSeconds ?? 10));
  const levels = question.geoUnlockLevels === 2 ? 2 : 1;
  const exploredValue = getGeoExploreValue(question.points, levels, boardValues);
  const availablePoints = potentialPoints ?? question.points;
  const sourceUrl = question.mapEmbedUrl ?? "";
  const teamName = answeringTeamName || currentTeamName;
  const [panoramaReady, setPanoramaReady] = useState(false);
  const mode = question.geoExplorationMode ?? "timed";
  const interaction = mode === "look" ? "look" : mode === "free" || !mapLocked ? "explore" : "fixed";

  if (mode === "stage") {
    return <GeoStageModal
      question={question}
      currentTeamName={currentTeamName}
      currentTeamColor={currentTeamColor}
      currentTeamEmoji={currentTeamEmoji}
      answeringTeamName={answeringTeamName}
      answeringTeamColor={answeringTeamColor}
      answeringTeamEmoji={answeringTeamEmoji}
      showAnswer={showAnswer}
      onRevealAnswer={onRevealAnswer}
      onFinish={onStageFinish ?? (() => undefined)}
      disableActions={disableActions}
    />;
  }

  return (
    <article className="card round-stage round-geo question-modal-card geo-question-modal">
      <QuestionModalHeader
        category={question.category}
        typeLabel="Geoguesser"
        points={availablePoints}
        teamName={teamName}
        teamColor={answeringTeamName ? answeringTeamColor : currentTeamColor}
        teamEmoji={answeringTeamName ? answeringTeamEmoji : currentTeamEmoji}
        teamLabel={showAnswer ? "Answered by" : answeringTeamName ? "Answering" : "Current team"}
      />

      <div className="question-modal-scroll geo-modal-scroll">
        {!showAnswer ? (
          <section className="geo-question-stage">
            <div className="geo-question-intro">
              <div>
                <span className="question-modal-eyebrow">Where are we?</span>
                {question.prompt && <h1>{question.prompt}</h1>}
              </div>
              <div className={`geo-exploration-status${interaction !== "fixed" ? " exploring" : ""}`} role="status">
                <span aria-hidden>{interaction === "fixed" ? "⌖" : "◌"}</span>
                <strong>{mode === "look" ? "Look & zoom" : mode === "free" ? "Explore freely" : mapLocked ? timerUsed ? "Exploration complete" : "View locked" : "Explore now"}</strong>
                {mode === "timed" && !mapLocked && countdownSeconds != null && <b>{countdownSeconds}s</b>}
              </div>
            </div>
            <StreetViewPanorama sourceUrl={sourceUrl} interaction={interaction} allowZoom={mode !== "timed"} className="geo-question-panorama" onReadyChange={setPanoramaReady} />
            <p className="geo-panorama-caption">
              {mode === "look"
                ? "Turn and zoom to inspect the scene. Moving to another spot is disabled; full points remain available."
                : mode === "free"
                  ? "Move, turn, and zoom as long as you like. No point cost."
                  : mapLocked
                ? "This is the host's chosen starting view. Exploring is a team choice."
                : `Explore while the timer runs. This question is now worth ${availablePoints} pts.`}
            </p>
          </section>
        ) : (
          <section className={`geo-answer-stage${question.answerImageData ? " has-image" : ""}`}>
            <div className="geo-answer-copy">
              <span className="question-modal-eyebrow">The location</span>
              <h1>{question.answer || "No answer provided."}</h1>
              {question.prompt && <p>{question.prompt}</p>}
              {question.answerLocationUrl && (
                <a className="geo-answer-link" href={question.answerLocationUrl} target="_blank" rel="noreferrer">
                  Open location in Google Maps ↗
                </a>
              )}
            </div>
            {question.answerImageData ? (
              <ExpandableImage
                src={question.answerImageData}
                alt={question.answerImageName || "Answer image"}
                label="Answer image"
                className="geo-answer-image"
                presentation="fluid"
              />
            ) : (
              <StreetViewPanorama sourceUrl={sourceUrl} interaction="explore" allowZoom className="geo-answer-panorama" />
            )}
          </section>
        )}
      </div>

      <QuestionModalActions
        revealed={showAnswer}
        onReveal={onRevealAnswer}
        onCorrect={onCorrect}
        onWrong={onWrong}
        disabled={disableActions}
        before={mode === "timed" && !showAnswer && (
          <div className="geo-explore-choice">
            <button
              className="button ghost geo-explore-button"
              type="button"
              onClick={onToggleLock}
              disabled={!panoramaReady || Boolean(timerUsed && mapLocked)}
            >
              {!mapLocked
                ? "Stop exploring"
                : timerUsed
                  ? "Exploration used"
                  : `Look around & move ${duration}s · ${exploredValue} pts`}
            </button>
            {!timerUsed && <small>Costs {levels} point level{levels === 2 ? "s" : ""} · {question.points} → {exploredValue}</small>}
          </div>
        )}
      />
    </article>
  );
}
