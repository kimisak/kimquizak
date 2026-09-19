'use client';

import type { CSSProperties } from "react";
import type { Question } from "@/lib/types";
import { JOKER_LEVEL_PERCENTAGES, JOKER_MAX_LEVEL } from "@/lib/jokerScoring";
import { QuestionModalHeader } from "./QuestionModalHeader";

export type JokerRound = {
  numbers: number[];
  targets: number[];
  correctDirs: ("above" | "below")[];
  jokerIndex: number;
  jokerPosition: "above" | "below";
};

export type JokerResult = "pending" | "correct" | "wrong" | "joker";

export type JokerProgress = {
  currentIndex: number;
  results: JokerResult[];
  level: number;
  score: number;
  finished: boolean;
  chosenPositions: ("above" | "below" | null)[];
};

type Props = {
  question: Question;
  currentTeamName?: string;
  currentTeamColor?: string;
  currentTeamEmoji?: string | null;
  answeringTeamName?: string;
  answeringTeamColor?: string;
  answeringTeamEmoji?: string | null;
  round: JokerRound;
  progress: JokerProgress;
  onGuess: (position: "above" | "below") => void;
  onFinish: () => void;
  disableActions?: boolean;
  maximumReward: number;
  rotateInfo?: boolean;
};

export function JokerModal({
  question,
  currentTeamName,
  currentTeamColor,
  currentTeamEmoji,
  answeringTeamName,
  answeringTeamColor,
  answeringTeamEmoji,
  round,
  progress,
  onGuess,
  onFinish,
  disableActions,
  maximumReward,
  rotateInfo,
}: Props) {
  const total = round.numbers.length;
  const activeIndex = total - 1 - progress.currentIndex;
  const canGuess = !progress.finished && !disableActions;
  const guessesLeft = progress.finished ? 0 : Math.max(total - progress.currentIndex, 0);
  const foundJoker = progress.results.includes("joker");
  const teamName = answeringTeamName || currentTeamName;
  const teamColor = answeringTeamName ? answeringTeamColor : currentTeamColor;
  const teamEmoji = answeringTeamName ? answeringTeamEmoji : currentTeamEmoji;
  const levelPercentage = JOKER_LEVEL_PERCENTAGES[
    Math.max(0, Math.min(JOKER_MAX_LEVEL - 1, progress.level - 1))
  ];

  const renderChoice = (position: "above" | "below", index: number) => {
    const active = index === activeIndex && canGuess;
    const result = progress.results[index] ?? "pending";
    const selected = progress.chosenPositions[index] === position;
    const visibleResult = selected ? result : "pending";
    const revealedValue = selected && result !== "pending"
      ? result === "joker" ? "🎩" : round.targets[index]
      : "";

    return (
      <button
        key={`${index}-${position}`}
        className={`joker-choice is-${position} is-${visibleResult}${active ? " is-active" : ""}${selected ? " is-selected" : ""}`}
        type="button"
        onClick={() => onGuess(position)}
        disabled={!active}
        aria-label={`${position === "above" ? "Higher" : "Lower"} than ${round.numbers[index]}`}
      >
        <strong>{revealedValue}</strong>
      </button>
    );
  };

  return (
    <article className={`card round-stage round-joker question-modal-card joker-question-modal${progress.finished ? " answer-visible" : ""}`}>
      <QuestionModalHeader
        category={question.category}
        typeLabel="Joker · Higher or lower"
        points={question.points}
        teamName={teamName}
        teamColor={teamColor}
        teamEmoji={teamEmoji}
        teamLabel={progress.finished ? "Points go to" : answeringTeamName ? "Guessing" : "Current team"}
      />

      <div className="question-modal-scroll joker-modal-scroll">
        <section className="joker-stage">
          <header className="joker-stage-intro">
            <div>
              <span className="question-modal-eyebrow">{progress.finished ? "Run complete" : "Choose from right to left"}</span>
              <h1>{progress.finished
                ? foundJoker ? "Joker found!" : "That’s the run."
                : question.prompt || "Will the hidden number be higher or lower?"}</h1>
              {progress.finished && question.answer && <p>{question.answer}</p>}
            </div>
            <div className={`joker-score-card${foundJoker ? " has-joker" : ""}`}>
              <small>{foundJoker ? "Level 6 · Joker" : `Level ${progress.level} of ${JOKER_MAX_LEVEL}`}</small>
              <strong>{progress.score}<span> pts</span></strong>
              <div className="joker-score-track" aria-hidden>
                <i style={{ "--joker-progress": `${levelPercentage * 100}%` } as CSSProperties} />
              </div>
              <p>{Math.round(levelPercentage * 100)}% of {maximumReward} points</p>
            </div>
          </header>

          <div className="joker-board" style={{ "--joker-columns": total } as CSSProperties} aria-label="Higher or lower board">
            {round.numbers.map((number, index) => {
              const result = progress.results[index] ?? "pending";
              const active = index === activeIndex && canGuess;
              return (
                <div className={`joker-lane is-${result}${active ? " is-active" : ""}`} key={index}>
                  {renderChoice("above", index)}
                  <div className="joker-number">
                    <strong>{number}</strong>
                  </div>
                  {renderChoice("below", index)}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <footer className={`question-modal-actions joker-actions${progress.finished ? " resolved" : ""}`}>
        {!progress.finished ? (
          <>
            <div className="joker-rule">
              <span aria-hidden>🎩</span>
              <p>
                <strong>Correct moves up one level; a miss moves down one.</strong> The Joker jumps directly to level 6 and 100% of {maximumReward} points. {rotateInfo ? "A miss also passes play to the next team." : "The same team stays in control after a miss."}
              </p>
            </div>
            <div className="joker-remaining">
              <strong>{guessesLeft}</strong>
              <small>{guessesLeft === 1 ? "guess left" : "guesses left"}</small>
            </div>
          </>
        ) : (
          <>
            <div className={`joker-result${foundJoker ? " has-joker" : ""}`}>
              <span aria-hidden>{foundJoker ? "🎩" : "✓"}</span>
              <div>
                <small>{foundJoker ? "Joker payout locked" : "Run completed"}</small>
                <strong>{progress.score} points</strong>
              </div>
            </div>
            <button className="button question-reveal-answer joker-continue" type="button" onClick={onFinish} disabled={disableActions}>
              Award {progress.score} pts &amp; continue
            </button>
          </>
        )}
      </footer>
    </article>
  );
}
