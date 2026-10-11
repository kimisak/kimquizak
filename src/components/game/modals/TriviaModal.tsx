'use client';

import { useRef, useState } from "react";
import type { Question, Team } from "@/lib/types";
import { getTriviaResults, isTriviaReviewed, type TriviaMarks } from "@/lib/trivia";
import { getTeamAccent } from "@/lib/teamPresentation";
import { TeamPill } from "../TeamPill";
import { QuestionModalHeader } from "./QuestionModalHeader";
import { ExpandableImage } from "./ExpandableImage";

export function TriviaModal({ question, teams, onAward }: {
  question: Question; teams: Team[]; onAward: (marks: TriviaMarks, reviewed: string[]) => void;
}) {
  const items = question.triviaItems ?? [];
  const [phase, setPhase] = useState<"ask" | "review" | "summary">("ask");
  const [index, setIndex] = useState(0);
  const [marks, setMarks] = useState<TriviaMarks>({});
  const [reviewed, setReviewed] = useState<string[]>([]);
  const awarding = useRef(false);
  const item = items[index];
  const results = getTriviaResults(question, teams.map(team => team.id), marks);
  const complete = isTriviaReviewed(question, reviewed);
  const progressLabel = phase === "ask" ? "Question progress" : "Answers reviewed";
  const nextAnswer = () => {
    if (!item) return;
    const next = [...new Set([...reviewed, item.id])];
    setReviewed(next);
    if (index < items.length - 1) setIndex(index + 1);
    else {
      const unreviewed = items.findIndex(candidate => !next.includes(candidate.id));
      if (unreviewed < 0) setPhase("summary");
      else setIndex(unreviewed);
    }
  };
  const teamPill = (team: Team) => <TeamPill name={team.name} emoji={team.badgeEmoji} color={getTeamAccent(team).base} />;
  return <article className="card round-stage question-modal-card trivia-modal">
    <QuestionModalHeader category={question.category} typeLabel="Trivia round · all teams" points={question.points} />
    <div className="trivia-body">
      <header className="trivia-title">
        <div className="trivia-progress">
          <span className="question-modal-eyebrow">{phase === "summary" ? "Round results" : phase === "review" ? "Answers" : "Questions"}</span>
          <ol className="trivia-progress-tokens" aria-label={progressLabel}>
            {items.map((entry, position) => {
              const done = phase === "ask" ? position < index : reviewed.includes(entry.id);
              const current = phase !== "summary" && position === index;
              return <li key={entry.id} className={`${done ? "is-complete" : ""}${current ? " is-current" : ""}`} aria-current={current ? "step" : undefined} aria-label={`${phase === "ask" ? "Question" : "Answer"} ${position + 1}${done ? ", complete" : ""}${current ? ", current" : ""}`}>
                <span>{position + 1}</span>{done && <small aria-hidden="true">✓</small>}
              </li>;
            })}
          </ol>
        </div>
        {question.prompt && <h2>{question.prompt}</h2>}
        <small>{phase === "ask" ? "Everyone answers on paper · points available per team" : phase === "review" ? "Select every team with a correct answer, then advance to confirm." : "Each team earns its own share of the full reward."}</small>
      </header>
      {phase === "summary" ? <div className="trivia-results">{results.map(result => {
        const team = teams.find(team => team.id === result.teamId)!;
        return <div key={team.id}>{teamPill(team)}<span>{result.correct}/{items.length} correct</span><strong>{result.points} pts</strong></div>;
      })}</div> : item && <>
        <section className={`trivia-content${item.imageData ? " has-image" : ""}`}>
          <div><h1 style={{ fontSize: `clamp(1.15rem, ${(phase === "review" ? item.answer : item.prompt).length > 200 ? "2.2" : "3.6"}vw, ${(phase === "review" ? item.answer : item.prompt).length > 200 ? "2" : "3.4"}rem)` }}>{phase === "review" ? item.answer : item.prompt}</h1>
            {phase === "review" && <p className="trivia-original">{item.prompt}</p>}</div>
          {item.imageData && <ExpandableImage src={item.imageData} alt={item.imageName || "Trivia image"} presentation="fluid" />}
        </section>
        {phase === "review" && <div className="trivia-marking" role="group" aria-label="Teams with correct answers">{teams.map(team => {
          const correct = marks[item.id]?.includes(team.id) ?? false;
          return <button type="button" key={team.id} className="trivia-team-mark" aria-label={`${team.name} correct`} aria-pressed={correct} onClick={() => {
            setMarks(previous => ({ ...previous, [item.id]: correct ? (previous[item.id] ?? []).filter(id => id !== team.id) : [...(previous[item.id] ?? []), team.id] }));
            setReviewed(previous => previous.filter(id => id !== item.id));
          }}>{teamPill(team)}<span>{correct ? "✓ Correct" : "Not correct"}</span></button>;
        })}</div>}
      </>}
    </div>
    <footer className="question-modal-actions trivia-actions">
      <div className="trivia-controls">
      {phase === "summary" ? <>
        <button type="button" className="button ghost" onClick={() => { setPhase("review"); setIndex(0); }}>Back to review</button>
        <button type="button" className="button question-reveal-answer" disabled={!complete || !teams.length} onClick={() => {
          if (awarding.current) return;
          awarding.current = true; onAward(marks, reviewed);
        }}>Award points &amp; finish</button>
      </> : <>
        {phase === "review" && <button type="button" className="button ghost" onClick={() => setPhase("ask")}>Back to questions</button>}
        <button type="button" className="button ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</button>
          <button type="button" className={`button ${phase === "review" ? "question-reveal-answer" : "ghost"}`} disabled={!item || (phase === "ask" && index === items.length - 1)} onClick={() => phase === "review" ? nextAnswer() : setIndex(index + 1)}>{phase === "review" && index === items.length - 1 ? "Finish review" : "Next"}</button>
        {phase === "ask" && <button type="button" className="button question-reveal-answer" disabled={index !== items.length - 1} onClick={() => { setPhase("review"); setIndex(0); }}>Review answers</button>}
      </>}
      </div>
    </footer>
  </article>;
}
