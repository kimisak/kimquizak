'use client';

import { useId, useMemo, useState, type CSSProperties } from "react";
import type { Question } from "@/lib/types";
import { ExpandableImage } from "./ExpandableImage";
import { QuestionModalActions } from "./QuestionModalActions";
import { QuestionModalHeader } from "./QuestionModalHeader";
import { getStandardAnswerCount, getStandardPoints } from "@/lib/standardScoring";

type Props = {
  question: Question;
  currentTeamName?: string;
  currentTeamEmoji?: string | null;
  answeringTeamName?: string;
  answeringTeamEmoji?: string | null;
  currentTeamColor?: string;
  answeringTeamColor?: string;
  onRevealAnswer: () => void;
  showAnswer: boolean;
  onCorrect: () => void;
  onWrong: () => void;
  onMarkAnswers: (correctCount: number) => void;
  disableActions?: boolean;
};

function getTextDensity(value?: string | null) {
  const length = (value || "").trim().length;
  if (length > 280) return "text-density-xlong";
  if (length > 175) return "text-density-long";
  if (length > 95) return "text-density-medium";
  return "text-density-short";
}

export function StandardModal({
  question,
  currentTeamName,
  currentTeamEmoji,
  answeringTeamName,
  answeringTeamEmoji,
  currentTeamColor,
  answeringTeamColor,
  onRevealAnswer,
  showAnswer,
  onCorrect,
  onWrong,
  onMarkAnswers,
  disableActions,
}: Props) {
  const [marking, setMarking] = useState(() => getStandardAnswerCount(question) > 3 ? "0" : "");
  const resultSelectId = useId();
  const answerCount = getStandardAnswerCount(question);
  const parsedCount = marking === "" ? NaN : Number(marking);
  const correctCount = Number.isInteger(parsedCount) && parsedCount >= 0 && parsedCount <= answerCount ? parsedCount : null;
  const awardedPoints = correctCount === null ? 0 : getStandardPoints(question, correctCount);
  const frontImage = useMemo(() => question.imageData
    ? { src: question.imageData, alt: question.imageName || "Question image" }
    : null, [question.imageData, question.imageName]);
  const answerImage = useMemo(() => question.answerImageData
    ? { src: question.answerImageData, alt: question.answerImageName || "Answer image" }
    : null, [question.answerImageData, question.answerImageName]);
  const teamName = answeringTeamName || currentTeamName;
  const teamColor = answeringTeamName ? answeringTeamColor : currentTeamColor;
  const teamEmoji = answeringTeamName ? answeringTeamEmoji : currentTeamEmoji;
  const displayedImage = showAnswer ? (answerImage || frontImage) : frontImage;

  return (
    <article className={`card round-stage round-standard question-modal-card standard-question-modal${showAnswer ? " answer-visible" : ""}`}>
      <QuestionModalHeader
        category={question.category}
        typeLabel="Standard"
        points={question.points}
        teamName={teamName}
        teamColor={teamColor}
        teamEmoji={teamEmoji}
        teamLabel={showAnswer ? "Answered by" : answeringTeamName ? "Answering" : "Current team"}
      />

      <div className="question-modal-scroll standard-modal-scroll">
        <section className={`standard-fluid-stage${displayedImage ? " has-image" : ""}`}>
          <div className="standard-fluid-copy">
            {!showAnswer ? (
              <>
              <span className="question-modal-eyebrow">Question</span>
              <h1 className={getTextDensity(question.prompt)}>{question.prompt || "No clue entered yet."}</h1>
              </>
            ) : (
              <>
              <div className="standard-answer-reveal">
                <span className="question-modal-eyebrow">Answer</span>
                <h1 className={getTextDensity(question.answer)}>{question.answer || "No answer provided."}</h1>
              </div>
              <div className="standard-answer-question">
                <span>Original question</span>
                <p className={getTextDensity(question.prompt)}>{question.prompt || "No clue entered yet."}</p>
              </div>
              </>
            )}
          </div>
          {displayedImage && (
            <ExpandableImage
              src={displayedImage.src}
              alt={displayedImage.alt}
              label={showAnswer && answerImage ? "Answer image" : "Question image"}
              presentation="fluid"
              className="standard-fluid-media"
            />
          )}
        </section>
      </div>

      {showAnswer && answerCount > 1 ? (
        <footer className="question-modal-actions standard-marking-actions">
          <div className="standard-marking-summary">
            {answerCount <= 3 && <span className="question-modal-eyebrow">Host marking</span>}
            <strong>{answerCount > 3 ? `${question.points} pts` : "How many answers were correct?"}</strong>
            <p>{answerCount > 3 ? `Split across ${answerCount} answers.` : `${question.points} pts split across ${answerCount} answers.`}</p>
          </div>
          <div className={`standard-marking-controls${answerCount > 3 ? " is-compact" : ""}`} style={{ "--standard-score-columns": Math.min(answerCount + 1, 4) } as CSSProperties}>
            {answerCount <= 3 ? <div className="standard-marking-options" role="group" aria-label="Correct answers">
              {Array.from({ length: answerCount + 1 }, (_, count) => (
                <button key={count} type="button"
                  className={`standard-marking-option${correctCount === count ? " selected" : ""}${count === 0 ? " is-zero" : ""}`}
                  aria-label={`${count} of ${answerCount} correct · ${getStandardPoints(question, count)} pts`}
                  aria-pressed={correctCount === count}
                  disabled={disableActions}
                  onClick={() => setMarking(String(count))}>
                  <strong>{count} / {answerCount}</strong>
                  <span>{getStandardPoints(question, count)} pts</span>
                </button>
              ))}
            </div> : <div className="standard-marking-result-control">
              <label className="question-modal-eyebrow" htmlFor={resultSelectId}>Correct answers</label>
              <select className="input standard-marking-result" id={resultSelectId}
                disabled={disableActions} value={marking} onChange={event => setMarking(event.target.value)}>
                {Array.from({ length: answerCount + 1 }, (_, count) => (
                  <option key={count} value={count}>
                    {count === 0 ? "None correct" : count === answerCount ? `All ${count} correct` : `${count} correct`} · {getStandardPoints(question, count)} pts
                  </option>
                ))}
              </select>
            </div>}
            <button className="button question-reveal-answer standard-marking-award" type="button"
              disabled={disableActions || correctCount === null}
              onClick={() => { if (correctCount !== null) onMarkAnswers(correctCount); }}>
              <span>Apply &amp; continue</span>
              <span className="standard-marking-award-points">{correctCount === null ? "—" : awardedPoints} pts</span>
            </button>
          </div>
        </footer>
      ) : <QuestionModalActions
        revealed={showAnswer}
        onReveal={onRevealAnswer}
        onCorrect={onCorrect}
        onWrong={onWrong}
        disabled={disableActions}
      />}
    </article>
  );
}
