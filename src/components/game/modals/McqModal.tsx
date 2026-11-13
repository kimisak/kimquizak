'use client';

import { useId, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { MCQ_MAX_OPTIONS, getMcqCorrectIndexes, getMcqOptionOrder, getMcqRequiredCorrect, getMcqPickPoints } from "@/lib/mcq";
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
  onMediaWidthChange?: (width: number | undefined) => void;
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
  onMediaWidthChange,
}: Props) {
  const options = question.mcqOptions?.slice(0, MCQ_MAX_OPTIONS) ?? [];
  const optionOrder = getMcqOptionOrder(question, progress);
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
  const stageRef = useRef<HTMLElement>(null);
  const answersId = useId();
  const automaticWidth = options.length > 4 ? 28 : 36;
  const [mediaWidth, setMediaWidth] = useState(question.mcqImageWidthPercent ?? automaticWidth);
  const [resizing, setResizing] = useState(false);
  const currentWidth = useRef(mediaWidth);
  const clampWidth = (value: number) => Math.max(18, Math.min(46, Math.round(value)));
  const updateWidth = (value: number, save = false) => {
    const next = clampWidth(value);
    currentWidth.current = next;
    setMediaWidth(next);
    if (save) onMediaWidthChange?.(next);
  };
  const moveDivider = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = stageRef.current?.getBoundingClientRect();
    if (bounds) updateWidth((bounds.right - event.clientX) / bounds.width * 100);
  };
  const finishResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setResizing(false);
    onMediaWidthChange?.(currentWidth.current);
  };
  const longOptions = options.some(option => option.length > 30);

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
        <section ref={stageRef} className={`mcq-stage${displayedImage ? " has-image" : ""}${longOptions ? " has-long-options" : ""}${resizing ? " is-resizing" : ""}`} style={{ "--mcq-media-width": `${clampWidth(mediaWidth)}%` } as CSSProperties}>
          <div id={answersId} className="mcq-main">
            <header className="mcq-prompt">
              <span className="question-modal-eyebrow">{resolved ? "Correct answers" : "Choose an answer"}</span>
              <h1 className={getPromptDensity(question.prompt)}>{question.prompt || "No question entered yet."}</h1>
            </header>

            <div className={`mcq-options option-count-${options.length}`}>
              {optionOrder.map((sourceIndex, displayIndex) => {
                const option = options[sourceIndex];
                const eliminatedOption = progress.eliminated.includes(sourceIndex);
                const foundOption = progress.found.includes(sourceIndex);
                const correctOption = foundOption || (resolved && correctIndexes.includes(sourceIndex));
                const mutedOption = resolved && !correctIndexes.includes(sourceIndex);
                const palette = OPTION_PALETTE[displayIndex % OPTION_PALETTE.length];
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
                    key={sourceIndex}
                    type="button"
                    disabled={eliminatedOption || foundOption || resolved}
                    onClick={() => onSelect(sourceIndex)}
                    style={{
                      "--mcq-option-base": palette.base,
                      "--mcq-option-glow": palette.glow,
                    } as CSSProperties}
                  >
                    <span className="mcq-option-letter" aria-label={correctOption ? (foundOption ? "Found" : "Correct") : undefined}>
                      {correctOption ? "✓" : String.fromCharCode(65 + displayIndex)}
                    </span>
                    <strong>{option || "(empty option)"}</strong>
                  </button>
                );
              })}
            </div>
          </div>

          {displayedImage && <>
            <div
              className="mcq-media-resizer"
              role="separator"
              tabIndex={0}
              aria-label="Resize question image"
              aria-controls={answersId}
              aria-orientation="vertical"
              aria-valuemin={18}
              aria-valuemax={46}
              aria-valuenow={clampWidth(mediaWidth)}
              aria-valuetext={`${clampWidth(mediaWidth)} percent image width`}
              title="Drag to resize the image · arrow keys to adjust · double-click to reset"
              onPointerDown={event => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.currentTarget.focus();
                event.currentTarget.setPointerCapture(event.pointerId);
                setResizing(true);
              }}
              onPointerMove={moveDivider}
              onPointerUp={finishResize}
              onPointerCancel={finishResize}
              onDoubleClick={() => {
                updateWidth(automaticWidth);
                onMediaWidthChange?.(undefined);
              }}
              onKeyDown={event => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                updateWidth(event.key === "Home" ? 18 : event.key === "End" ? 46 : currentWidth.current + (event.key === "ArrowLeft" ? 2 : -2), true);
              }}
            />
            <ExpandableImage
              key={resolved && question.answerImageData ? "answer-image" : "question-image"}
              src={displayedImage.src}
              alt={displayedImage.alt}
              label={displayedImage.label}
              presentation="fluid"
              className="mcq-media"
            />
          </>}
        </section>
      </div>

      <footer className={`question-modal-actions mcq-actions${resolved ? " resolved" : ""}`}>
        {!resolved ? <>
          <div className="mcq-rule" aria-live="polite">
            <span aria-hidden>✦</span>
            <p>Find {required} correct {required === 1 ? "answer" : "answers"}. Correct picks earn points and keep your turn.
              <strong className="question-rule-consequence"><span className="question-rule-warning">Wrong answer:</span>{" "}{rolloverEnabled
                ? "play passes to the next team."
                : "the question ends."} Earned points are kept.</strong></p>
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
