'use client';

import { useEffect, useRef, useState } from "react";
import type { Question } from "@/lib/types";
import { ExpandableImage } from "./ExpandableImage";
import { QuestionModalHeader } from "./QuestionModalHeader";

type Props = {
  question: Question;
  showMessage: boolean;
  onReveal: () => void;
  onWon: () => void;
  onLost: () => void;
  disableActions?: boolean;
  teamName?: string;
  teamColor?: string;
  teamEmoji?: string | null;
};

function getMessageDensity(message: string) {
  if (message.length > 280) return "text-density-xlong";
  if (message.length > 160) return "text-density-long";
  if (message.length > 85) return "text-density-medium";
  return "text-density-short";
}

function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function BoobyModal({
  question,
  showMessage,
  onReveal,
  onWon,
  onLost,
  disableActions,
  teamName,
  teamColor,
  teamEmoji,
}: Props) {
  const message = question.prompt.trim();
  const onRevealRef = useRef(onReveal);
  const duration = question.challengeTimerSeconds && question.challengeTimerSeconds > 0
    ? Math.max(5, Math.min(1800, Math.round(question.challengeTimerSeconds)))
    : null;
  const timerMode = question.challengeTimerMode === "countup" ? "countup" : "countdown";
  const showExactTime = question.challengeTimerShowTime !== false;
  const [remainingMs, setRemainingMs] = useState((duration ?? 0) * 1000);
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [clockState, setClockState] = useState<"idle" | "running" | "paused" | "finished">("idle");

  useEffect(() => {
    if (deadlineMs === null) return;
    const tick = () => {
      const next = Math.max(0, deadlineMs - Date.now());
      setRemainingMs(next);
      if (next === 0) {
        setDeadlineMs(null);
        setClockState("finished");
      }
    };
    tick();
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
  }, [deadlineMs]);

  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const elapsedSeconds = duration === null ? 0 : Math.floor((duration * 1000 - remainingMs) / 1000);
  const displayedSeconds = timerMode === "countup" ? elapsedSeconds : remainingSeconds;
  const progressPercent = duration === null ? 0 : timerMode === "countup"
    ? 100 * (1 - remainingMs / (duration * 1000))
    : 100 * remainingMs / (duration * 1000);

  const startOrPauseClock = () => {
    if (duration === null) return;
    if (clockState === "running" && deadlineMs !== null) {
      setRemainingMs(Math.max(0, deadlineMs - Date.now()));
      setDeadlineMs(null);
      setClockState("paused");
      return;
    }
    const nextRemaining = clockState === "idle" ? duration * 1000 : remainingMs;
    setRemainingMs(nextRemaining);
    setDeadlineMs(Date.now() + nextRemaining);
    setClockState("running");
  };

  const resetClock = () => {
    setDeadlineMs(null);
    setRemainingMs((duration ?? 0) * 1000);
    setClockState("idle");
  };

  useEffect(() => {
    onRevealRef.current = onReveal;
  }, [onReveal]);

  useEffect(() => {
    if (showMessage) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => onRevealRef.current(), reducedMotion ? 120 : 1800);
    return () => window.clearTimeout(timer);
  }, [question.id, showMessage]);

  return (
    <article className={`card round-stage round-booby question-modal-card booby-modal${showMessage ? " is-revealed" : ""}${showMessage && duration !== null ? " has-clock" : ""}`}>
      <QuestionModalHeader
        category={question.category}
        typeLabel={showMessage ? "Challenge" : "Question"}
        points={question.points}
        teamName={teamName}
        teamColor={teamColor}
        teamEmoji={teamEmoji}
        teamLabel="Challenged team"
      />
      {showMessage && duration !== null && (
        <div className={`challenge-clock-toolbar state-${clockState}`}>
          <div className="challenge-clock-readout" role="timer" aria-label={showExactTime ? `${formatClock(displayedSeconds)} ${timerMode === "countdown" ? "remaining" : "elapsed"}` : `${timerMode === "countdown" ? "Countdown" : "Count-up timer"} ${clockState}`}>
            <small>{clockState === "finished" ? "Time's up" : timerMode === "countdown" ? "Countdown" : "Count-up timer"}</small>
            {showExactTime ? <strong>{formatClock(displayedSeconds)}</strong> : <strong>{clockState === "finished" ? "Time's up!" : clockState === "running" ? "In progress" : clockState === "paused" ? "Paused" : "Ready"}</strong>}
          </div>
          <div className="challenge-clock-track" aria-hidden="true"><span style={{ width: `${progressPercent}%` }} /></div>
          <div className="challenge-clock-controls">
            <button className="button ghost compact" type="button" onClick={startOrPauseClock} disabled={clockState === "finished"}>
              {clockState === "running" ? "Pause" : clockState === "paused" ? "Resume" : `Start ${timerMode === "countdown" ? "countdown" : "timer"}`}
            </button>
            <button className="button ghost compact" type="button" onClick={resetClock} disabled={clockState === "idle"}>Reset</button>
          </div>
        </div>
      )}
      <div className="question-modal-scroll booby-modal-scroll">
        {!showMessage ? (
          <div className="booby-opening-stage" role="status" aria-label="Opening a present">
            <div className="booby-gift" aria-hidden>
              <span className="booby-gift-shine" />
              <span className="booby-gift-box" />
              <span className="booby-gift-lid" />
              <span className="booby-gift-bow" />
              <span className="booby-gift-spark one">✦</span>
              <span className="booby-gift-spark two">✦</span>
              <span className="booby-gift-spark three">✦</span>
              <span className="booby-gift-spark four">✦</span>
            </div>
          </div>
        ) : (
          <div className={`booby-reveal-stage${question.imageData ? " has-image" : ""}`}>
            <div className="booby-reveal-copy">
              <span className="question-modal-eyebrow">Your challenge · {question.points} points at stake</span>
              <h1 className={getMessageDensity(message)}>{message}</h1>
              <p>Complete the challenge to win the points.</p>
            </div>
            {question.imageData && (
              <ExpandableImage
                src={question.imageData}
                alt={question.imageName || "Challenge picture"}
                label="Challenge picture"
                presentation="fluid"
                className="booby-reveal-image"
              />
            )}
          </div>
        )}
      </div>
      {showMessage && (
        <footer className="question-modal-actions booby-modal-actions">
          <span>Host decides the outcome</span>
          <div className="question-modal-score-actions">
            <button className="button question-score-wrong" type="button" onClick={onLost} disabled={disableActions}>
              <span aria-hidden>×</span> Not completed · 0 pts
            </button>
            <button className="button question-score-correct" type="button" onClick={onWon} disabled={disableActions}>
              <span aria-hidden>✓</span> Completed · +{question.points} pts
            </button>
          </div>
        </footer>
      )}
    </article>
  );
}
