'use client';

import { useRef, useState } from "react";
import type { Question, Team } from "@/lib/types";
import { getTriviaResults, getTriviaTeamIds, isTriviaReviewed, type TriviaMarks } from "@/lib/trivia";
import { getTeamAccent } from "@/lib/teamPresentation";
import { TeamPill } from "../TeamPill";
import { QuestionModalHeader } from "./QuestionModalHeader";
import { ExpandableImage } from "./ExpandableImage";

export function TriviaModal({ question, teams, defaultTeamId, onAward }: {
  question: Question;
  teams: Team[];
  defaultTeamId?: string;
  onAward: (marks: TriviaMarks, reviewed: string[], selectedTeamId?: string) => void;
}) {
  const items = question.triviaItems ?? [];
  const [phase, setPhase] = useState<"ask" | "review" | "summary">("ask");
  const [index, setIndex] = useState(0);
  const [marks, setMarks] = useState<TriviaMarks>({});
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState(() => (
    teams.some(team => team.id === defaultTeamId) ? defaultTeamId! : teams[0]?.id ?? ""
  ));
  const awarding = useRef(false);
  const item = items[index];
  const singleTeam = question.triviaMode === "single";
  const roundTeamIds = getTriviaTeamIds(question, teams.map(team => team.id), selectedTeamId);
  const roundTeams = teams.filter(team => roundTeamIds.includes(team.id));
  const results = getTriviaResults(question, roundTeamIds, marks);
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
    <QuestionModalHeader category={question.category} typeLabel={`Trivia round · ${singleTeam ? "one team" : "all teams"}`} points={question.points} />
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
        {singleTeam && <label className="trivia-team-picker">Playing team
          <select className="input" value={selectedTeamId} disabled={phase !== "ask" || index > 0} onChange={event => {
            setSelectedTeamId(event.target.value);
            setMarks({});
            setReviewed([]);
          }}>
            {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>}
        <small>{phase === "ask"
          ? singleTeam ? `${roundTeams[0]?.name ?? "The selected team"} answers · ${question.points} points available` : "Everyone answers on paper · points available per team"
          : phase === "review" ? singleTeam ? `Mark ${roundTeams[0]?.name ?? "the team"}'s answer, then advance to confirm.` : "Select every team with a correct answer, then advance to confirm."
            : singleTeam ? "The selected team earns a share for each correct answer." : "Each team earns its own share of the full reward."}</small>
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
        {phase === "review" && <div className="trivia-marking" role="group" aria-label="Teams with correct answers">{roundTeams.map(team => {
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
        <button type="button" className="button question-reveal-answer" disabled={!complete || !roundTeams.length} onClick={() => {
          if (awarding.current) return;
          awarding.current = true; onAward(marks, reviewed, singleTeam ? selectedTeamId : undefined);
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
