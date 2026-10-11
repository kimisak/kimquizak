'use client';

import type { CSSProperties } from "react";
import { MCQ_MAX_OPTIONS, getMcqCorrectIndexes, getMcqRequiredCorrect, getMcqPickPoints } from "@/lib/mcq";
import type { Question, McqProgress, Team } from "@/lib/types";
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
  progress: McqProgress;
  teams: Team[];
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
  progress,
  teams,
  onSelect,
  onContinue,
}: Props) {
  const options = question.mcqOptions?.slice(0, MCQ_MAX_OPTIONS) ?? [];
  const teamName = answeringTeamName || currentTeamName;
  const teamColor = answeringTeamName ? answeringTeamColor : currentTeamColor;
  const teamEmoji = answeringTeamName ? answeringTeamEmoji : currentTeamEmoji;
  const resolved = progress.finished;
  const displayedImage = resolved
    ? question.answerImageData
      ? { src: question.answerImageData, alt: question.answerImageName || "Answer image", label: "Answer image" }
      : question.imageData
        ? { src: question.imageData, alt: question.imageName || "Question image", label: "Question image" }
        : null
    : question.imageData
      ? { src: question.imageData, alt: question.imageName || "Question image", label: "Question image" }
      : null;
  const correctIndexes = getMcqCorrectIndexes(question);
  const required = getMcqRequiredCorrect(question);
  const nextPoints = getMcqPickPoints(question, progress.found.length);
  const totalAwarded = Object.values(progress.pointsByTeam).reduce((sum, points) => sum + points, 0);
  const rolloverEnabled = question.mcqRotateOnMiss === true;

  return (
    <article className={`card round-stage round-mcq question-modal-card mcq-question-modal${options.length > 4 ? " has-many-options" : ""}${resolved ? " answer-visible" : ""}`}>
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
              <span className="question-modal-eyebrow">{resolved ? "Correct answers" : "Choose an answer"}</span>
              <h1 className={getPromptDensity(question.prompt)}>{question.prompt || "No question entered yet."}</h1>
            </header>

            <div className={`mcq-options option-count-${options.length}`}>
              {options.map((option, index) => {
                const eliminatedOption = progress.eliminated.includes(index);
                const foundOption = progress.found.includes(index);
                const correctOption = foundOption || (resolved && correctIndexes.includes(index));
                const mutedOption = resolved && !correctIndexes.includes(index);
                const palette = OPTION_PALETTE[index % OPTION_PALETTE.length];
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
                    disabled={eliminatedOption || foundOption || resolved}
                    onClick={() => onSelect(index)}
                    style={{
                      "--mcq-option-base": palette.base,
                      "--mcq-option-glow": palette.glow,
                    } as CSSProperties}
                  >
                    <span className="mcq-option-letter">{String.fromCharCode(65 + index)}</span>
                    <strong>{option || "(empty option)"}</strong>
                    {eliminatedOption && !correctOption && <small>Passed</small>}
                    {correctOption && <small>{foundOption && !resolved ? "Found" : "Correct"}</small>}
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
        {!resolved ? <>
          <div className="mcq-rule" aria-live="polite">
            <span aria-hidden>✦</span>
            <p><strong>Find {required} correct {required === 1 ? "answer" : "answers"}.</strong>{" "}
              Correct picks earn points and keep your turn. {rolloverEnabled
                ? "A miss passes to the next team."
                : "A miss ends the question."} Earned points are kept.</p>
          </div>
          <div className="mcq-remaining" aria-live="polite">
            <strong>{progress.found.length}/{required}</strong>
            <small>found · next +{nextPoints} pts</small>
          </div>
        </> : <>
          <div className={`mcq-result${progress.lastCorrect === false ? " is-wrong" : ""}`}>
            <span aria-hidden>{progress.lastCorrect === false ? "×" : "✓"}</span>
            <div>
              <small>Question complete · {totalAwarded} pts awarded</small>
              <strong>{progress.found.length}/{required} correct answers found</strong>
              <div className="mcq-awards">{teams.filter(team => progress.pointsByTeam[team.id] !== undefined).map(team =>
                <span key={team.id}>{team.name}: +{progress.pointsByTeam[team.id]}</span>
              )}</div>
            </div>
          </div>
          <button className="button question-reveal-answer mcq-continue" type="button" onClick={onContinue}>Continue</button>
        </>}
      </footer>
    </article>
  );
}
