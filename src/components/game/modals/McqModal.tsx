'use client';

import type { CSSProperties } from "react";
import type { Question } from "@/lib/types";
import { ExpandableImage } from "./ExpandableImage";
import { QuestionModalHeader } from "./QuestionModalHeader";

type Props = {
  question: Question;
  currentTeamName?: string;
  answeringTeamName?: string;
  currentTeamColor?: string;
  answeringTeamColor?: string;
  currentTeamEmoji?: string | null;
  answeringTeamEmoji?: string | null;
  eliminated: number[];
  resolved?: boolean;
  correctIndex?: number;
  resolvedInfo?: { teamName: string; points: number; correct: boolean } | null;
  onSelect: (idx: number) => void;
  onContinue: () => void;
};

const OPTION_PALETTE = [
  { base: "#a83b4c", glow: "#f5c3c7" },
  { base: "#34795b", glow: "#c8ead3" },
  { base: "#4e7199", glow: "#d6e9f8" },
  { base: "#b38132", glow: "#f7e1a8" },
];

function getPromptDensity(value?: string | null) {
  const length = (value || "").trim().length;
  if (length > 240) return "text-density-xlong";
  if (length > 145) return "text-density-long";
  if (length > 80) return "text-density-medium";
  return "text-density-short";
}

export function McqModal({
  question,
  currentTeamName,
  answeringTeamName,
  currentTeamColor,
  answeringTeamColor,
  currentTeamEmoji,
  answeringTeamEmoji,
  eliminated,
  resolved = false,
  correctIndex = 0,
  resolvedInfo = null,
  onSelect,
  onContinue,
}: Props) {
  const rawOptions = question.mcqOptions?.slice(0, 4) ?? [];
  const options = Array.from({ length: 4 }, (_, index) => rawOptions[index] ?? "");
  const teamName = answeringTeamName || currentTeamName;
  const teamColor = answeringTeamName ? answeringTeamColor : currentTeamColor;
  const teamEmoji = answeringTeamName ? answeringTeamEmoji : currentTeamEmoji;
  const displayedImage = resolved
    ? question.answerImageData
      ? { src: question.answerImageData, alt: question.answerImageName || "Answer image", label: "Answer image" }
      : question.imageData
        ? { src: question.imageData, alt: question.imageName || "Question image", label: "Question image" }
        : null
    : question.imageData
      ? { src: question.imageData, alt: question.imageName || "Question image", label: "Question image" }
      : null;
  const remainingOptions = options.length - eliminated.length;
  const correctAnswer = options[correctIndex] || "Correct option";
  const rolloverEnabled = question.mcqRotateOnMiss === true;

  return (
    <article className={`card round-stage round-mcq question-modal-card mcq-question-modal${resolved ? " answer-visible" : ""}`}>
      <QuestionModalHeader
        category={question.category}
        typeLabel="Multiple choice"
        points={question.points}
        teamName={teamName}
        teamColor={teamColor}
        teamEmoji={teamEmoji}
        teamLabel={resolved ? "Answered by" : answeringTeamName ? "Answering" : "Current team"}
      />

      <div className="question-modal-scroll mcq-modal-scroll">
        <section className={`mcq-stage${displayedImage ? " has-image" : ""}`}>
          <div className="mcq-main">
            <header className="mcq-prompt">
              <span className="question-modal-eyebrow">{resolved ? "Correct answer" : "Choose one"}</span>
              <h1 className={getPromptDensity(question.prompt)}>{question.prompt || "No question entered yet."}</h1>
            </header>

            <div className={`mcq-options option-count-${options.length}`}>
              {options.map((option, index) => {
                const eliminatedOption = eliminated.includes(index);
                const correctOption = resolved && index === correctIndex;
                const mutedOption = resolved && index !== correctIndex;
                const palette = OPTION_PALETTE[index];
                const stateClass = correctOption
                  ? " is-correct"
                  : eliminatedOption
                    ? " is-eliminated"
                    : mutedOption
                      ? " is-muted"
                      : "";

                return (
                  <button
                    className={`mcq-option${stateClass}`}
                    key={index}
                    type="button"
                    disabled={eliminatedOption || resolved}
                    onClick={() => onSelect(index)}
                    style={{
                      "--mcq-option-base": palette.base,
                      "--mcq-option-glow": palette.glow,
                    } as CSSProperties}
                  >
                    <span className="mcq-option-letter">{String.fromCharCode(65 + index)}</span>
                    <strong>{option || "(empty option)"}</strong>
                    {eliminatedOption && !correctOption && <small>Passed</small>}
                    {correctOption && <small>Correct</small>}
                  </button>
                );
              })}
            </div>
          </div>

          {displayedImage && (
            <ExpandableImage
              key={resolved && question.answerImageData ? "answer-image" : "question-image"}
              src={displayedImage.src}
              alt={displayedImage.alt}
              label={displayedImage.label}
              presentation="fluid"
              className="mcq-media"
            />
          )}
        </section>
      </div>

      <footer className={`question-modal-actions mcq-actions${resolved ? " resolved" : ""}`}>
        {!resolved ? (
          <>
            <div className="mcq-rule" aria-live="polite">
              <span aria-hidden>✦</span>
              <p>
                <strong>Choose carefully.</strong> {rolloverEnabled
                  ? "A wrong option disappears and play passes to the next team without changing the score."
                  : "There is one attempt. A wrong answer ends the question for 0 points."}
              </p>
            </div>
            <div className="mcq-remaining">
              <strong>{remainingOptions}</strong>
              <small>{remainingOptions === 1 ? "option remains" : "options remain"}</small>
            </div>
          </>
        ) : (
          <>
            <div className={`mcq-result${resolvedInfo?.correct === false ? " is-wrong" : ""}`}>
              <span aria-hidden>{resolvedInfo?.correct === false ? "×" : "✓"}</span>
              <div>
                <small>{resolvedInfo?.correct === false ? "No points awarded" : "Answer locked"}{resolvedInfo?.correct ? ` · +${resolvedInfo.points} pts` : ""}</small>
                <strong>{String.fromCharCode(65 + correctIndex)} · {correctAnswer}</strong>
              </div>
            </div>
            <button className="button question-reveal-answer mcq-continue" type="button" onClick={onContinue}>
              Continue
            </button>
          </>
        )}
      </footer>
    </article>
  );
}
