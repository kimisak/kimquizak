'use client';

import { useMemo } from "react";
import type { Question } from "@/lib/types";
import { ExpandableImage } from "./ExpandableImage";
import { QuestionModalActions } from "./QuestionModalActions";
import { QuestionModalHeader } from "./QuestionModalHeader";

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
  disableActions,
}: Props) {
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

      <QuestionModalActions
        revealed={showAnswer}
        onReveal={onRevealAnswer}
        onCorrect={onCorrect}
        onWrong={onWrong}
        disabled={disableActions}
      />
    </article>
  );
}
