'use client';

import type { ImageRevealProgress, Question, Team } from "@/lib/types";
import { getImageRevealLevels, getImageAreaPlayableIndexes, IMAGE_REVEAL_STYLES } from "@/lib/imageReveal";
import { ImageRevealCanvas } from "../ImageRevealCanvas";
import { QuestionModalHeader } from "./QuestionModalHeader";
import { getTeamAccent } from "@/lib/teamPresentation";

export function ImageRevealModal({ question, progress, team, nextPoints, onMore, onReveal, onWrong, onResolve, onFinish, onChooseArea }: {
  question: Question; progress: ImageRevealProgress; team?: Team; nextPoints: number;
  onMore: () => void; onReveal: (shown: boolean) => void; onWrong: () => void; onResolve: (correct: boolean) => void; onFinish: () => void;
  onChooseArea: (area: number) => void;
}) {
  const levels = getImageRevealLevels(question.imageRevealLevels);
  const step = Math.min(progress.step, levels.length - 1);
  const resolved = Boolean(progress.outcome);
  const showingAnswer = resolved || progress.answerRevealed === true;
  const isAreas = question.imageRevealStyle === "areas";
  const playableAreas = getImageAreaPlayableIndexes(question);
  const revealedAreas = progress.revealedAreas ?? [];
  const limited = isAreas && question.imageRevealAreaMode === "limited";
  const revealedCount = playableAreas.filter(area => revealedAreas.includes(area)).length;
  const allAreasOpen = playableAreas.length > 0 && revealedCount === playableAreas.length;
  const canChoose = isAreas && Boolean(team) && !showingAnswer && !progress.areaChosenThisTurn && !allAreasOpen;
  const canJudge = Boolean(team) && !showingAnswer && (progress.areaChosenThisTurn || (!limited && allAreasOpen));
  const choosingLimitedArea = limited && !showingAnswer && !progress.areaChosenThisTurn;
  const shownPoints = choosingLimitedArea ? nextPoints : progress.points;
  const attempt = Math.min(playableAreas.length, revealedCount + (progress.areaChosenThisTurn ? 0 : 1));
  const areaInstruction = !playableAreas.length ? "No covered areas to reveal"
    : progress.areaChosenThisTurn ? "Make your guess"
      : allAreasOpen ? "All areas open · make your guess"
        : revealedCount && limited ? "Choose your next area" : "Choose one numbered area";
  return (
    <article className="card round-stage question-modal-card image-reveal-modal">
      <QuestionModalHeader category={question.category} typeLabel="Image reveal" points={shownPoints}
        teamName={team?.name} teamColor={team ? getTeamAccent(team).base : undefined} teamEmoji={team?.badgeEmoji}
        teamLabel={resolved ? progress.outcome === "correct" ? "Answered by" : "No points" : "Answering"} />
      <div className="image-reveal-stage">
        <header className="image-reveal-prompt">
          <span className="question-modal-eyebrow">{showingAnswer ? "The full picture" : IMAGE_REVEAL_STYLES[question.imageRevealStyle === "noise" ? "areas" : question.imageRevealStyle || "zoom"]}</span>
          <h1 className={(showingAnswer ? question.answer : question.prompt).length > 130 ? "is-long" : ""}>{showingAnswer ? question.answer : question.prompt || "What are we looking at?"}</h1>
        </header>
        <div className="image-reveal-picture-with-legend">
          <ImageRevealCanvas question={question} step={step} full={showingAnswer} revealedAreas={revealedAreas} onChooseArea={canChoose ? onChooseArea : undefined} />
          {isAreas && !showingAnswer && <div className="image-area-legend image-area-play-choices" role="group" aria-label="Choose an area">{playableAreas.map(index => <button type="button" key={index} aria-label={revealedAreas.includes(index) ? `Area ${index + 1} open` : `Choose area ${index + 1}`} className={revealedAreas.includes(index) ? "is-open" : ""} disabled={!canChoose || revealedAreas.includes(index)} onClick={() => onChooseArea(index)}><b>{index + 1}</b>{revealedAreas.includes(index) ? 'Open' : 'Reveal'}</button>)}</div>}
        </div>
        <div className={`image-reveal-progress${isAreas ? " image-area-play-status" : ""}`} aria-live="polite">
          <span>{resolved ? progress.outcome === "correct" ? `${progress.points} pts ready to award` : "No points awarded" : isAreas ? areaInstruction : `Stage ${step + 1} of ${levels.length}`}</span>
          {isAreas && !showingAnswer ? <small>{limited
            ? `Guess ${attempt} of ${playableAreas.length} · ${choosingLimitedArea && revealedCount ? `Next guess: ${nextPoints} pts` : revealedCount <= 1 ? "First guess at full reward" : `${progress.points} pts available`}`
            : "Teams take turns · reward stays the same"}</small>
            : !isAreas && <div aria-hidden>{levels.map((_, i) => <i key={i} className={resolved || i <= step ? "is-lit" : ""} />)}</div>}
        </div>
      </div>
      <footer className="question-modal-actions image-reveal-actions">
        {resolved ? <><span>The answer is revealed.</span><button type="button" className="button question-reveal-answer" onClick={onFinish}>{progress.outcome === "correct" ? "Award points & continue" : "Continue"}</button></> : isAreas ? <>
          <button type="button" className="button ghost image-area-play-end" onClick={() => onResolve(false)}>End question & reveal</button>
          <div className="question-modal-score-actions">
            <button type="button" className="button question-score-wrong" disabled={!canJudge} onClick={onWrong}>{limited ? "Wrong" : "Wrong · next team"}</button>
            <button type="button" className="button question-score-correct" disabled={!canJudge} onClick={() => onResolve(true)}>Correct</button>
          </div>
        </> : !showingAnswer ? <>
          <div className="image-reveal-assists">
            <button type="button" className="button" disabled={step >= levels.length - 1} onClick={onMore}>{step >= levels.length - 1 ? "Final stage" : "Reveal more"}</button>
          </div>
          <button type="button" className="button question-reveal-answer" onClick={() => onReveal(true)}>Reveal answer</button>
        </> : <>
          <button type="button" className="button ghost" onClick={() => onReveal(false)}>Back to question</button>
          <div className="question-modal-score-actions">
            <button type="button" className="button question-score-wrong" disabled={!team} onClick={onWrong}>{question.imageRevealRotateOnMiss === false ? "Wrong" : "Wrong · next team"}</button>
            <button type="button" className="button question-score-correct" disabled={!team} onClick={() => onResolve(true)}>Correct</button>
          </div>
        </>}
      </footer>
    </article>
  );
}
