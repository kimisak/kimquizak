'use client';

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ConnectionsProgress, Question, Team } from "@/lib/types";
import { connectionsGuessSeconds, connectionsMistakeLimit, connectionsRequired, type ConnectionsAction } from "@/lib/connections";
import { getTeamAccent } from "@/lib/teamPresentation";
import { QuestionModalHeader } from "./QuestionModalHeader";

function ConnectionsHint() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 2800);
    return () => window.clearTimeout(timer);
  }, []);
  return visible ? <div className="connections-hint" role="status">Three are correct</div> : null;
}

export function ConnectionsModal({ question, progress, teams, onAction, onContinue }: {
  question: Question; progress: ConnectionsProgress; teams: Team[];
  onAction: (action: ConnectionsAction) => void; onContinue: () => void;
}) {
  const [selection, setSelected] = useState<number[]>([]);
  const selected = selection.filter(tile => !progress.solved.includes(Math.floor(tile / 4)));
  const [now, setNow] = useState(() => Date.now());
  const [revealed, setRevealed] = useState(0);
  const callback = useRef(onAction);
  useLayoutEffect(() => { callback.current = onAction; }, [onAction]);
  useEffect(() => {
    if (!progress.started || progress.finished || progress.deadline === null) return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (time >= progress.deadline!) { setSelected([]); callback.current({ type: "timeout" }); }
    };
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [progress.started, progress.finished, progress.deadline]);
  const groups = question.connectionsGroups ?? [];
  const words = groups.flatMap(group => group.words);
  const required = connectionsRequired(question);
  const totalGroups = groups.length;
  const hasTimer = connectionsGuessSeconds(question) > 0;
  const remainingGroups = groups.map((_, index) => index).filter(index => !progress.solved.includes(index));
  useEffect(() => {
    if (!progress.finished || revealed >= remainingGroups.length) return;
    const timer = window.setTimeout(() => setRevealed(count => count + 1), 1200);
    return () => window.clearTimeout(timer);
  }, [progress.finished, remainingGroups.length, revealed]);
  const team = teams.find(item => item.id === progress.teamId);
  const seconds = progress.deadline === null ? null : Math.max(0, Math.ceil((progress.deadline - now) / 1000));
  const limit = connectionsMistakeLimit(question);
  const attempted = progress.attempts.includes([...selected].sort((a, b) => a - b).join(","));
  const finishedRevealing = revealed >= remainingGroups.length;
  const groupRow = (index: number, earned: boolean) => <div className={`connections-group group-${index}${earned ? " earned" : " revealed"}`} key={index}>
    <small>{earned ? "Found" : "Revealed · no points"}</small><strong>{groups[index].label}</strong><span>{groups[index].words.join(" · ")}</span>
  </div>;
  return <article className="card round-stage question-modal-card connections-modal">
    <QuestionModalHeader category={question.category} typeLabel="Connections" points={question.points} teamName={progress.finished ? undefined : team?.name} teamColor={team ? getTeamAccent(team).base : undefined} teamEmoji={team?.badgeEmoji} teamLabel="Current team" />
    <div className="connections-body">
      {progress.feedback === "Three are correct" && <ConnectionsHint key={progress.mistakes} />}
      <header className="connections-heading"><div><span className="question-modal-eyebrow">{progress.finished ? "Answers" : "Four tiles. One connection."}</span><h1>{question.prompt || "Find the connections"}</h1></div>
        {progress.started && !progress.finished && seconds !== null && <div className={`connections-clock${seconds !== null && seconds <= 10 ? " urgent" : ""}`} role="timer" aria-label="Time left for this guess">{`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</div>}
      </header>
      {!progress.started && !progress.finished ? <div className="connections-intro">
        <span className="connections-symbol" aria-hidden>▦</span><h2>Find {required === 4 ? "all 4" : `any ${required} of 4`} connections</h2>
        <p>Select four tiles that share a connection, then submit your guess. Points are split across {required} required {required === 1 ? "connection" : "connections"}. Correct groups keep your turn until the target is reached.</p>
        <div className="connections-rules">{hasTimer && <span>{connectionsGuessSeconds(question)} seconds per guess</span>}<span>{limit ? `${limit} shared mistakes` : "Unlimited mistakes"}</span><span>{question.connectionsRotateOnMiss !== false ? "Mistakes pass the turn" : "Same team keeps playing"}</span></div>
        {hasTimer && <p>The timer starts when the tiles appear. It keeps running if you close the round.</p>}
        <button className="button" disabled={!team} onClick={() => onAction({ type: "start" })}>Start round</button>
      </div> : progress.finished ? <div className="connections-answers">
        <p className="connections-outcome">{progress.finishReason === "solved" ? (required === 4 ? "All connections found!" : "Target reached!") : progress.finishReason === "mistakes" ? "Mistake limit reached." : "Round ended by the host."} {progress.solved.length}/{required} groups found.</p>
        <div className="connections-answer-groups" style={{ gridTemplateRows: `repeat(${totalGroups}, minmax(0, 1fr))` }}>{progress.solved.map(index => groupRow(index, true))}{remainingGroups.map((index, position) => position < revealed ? groupRow(index, false) : <div className="connections-group pending" key={index}><span>Connection {position + 1} · revealing…</span></div>)}</div>
        <div className="connections-awards">{teams.filter(item => progress.pointsByTeam[item.id] !== undefined).map(item => <span key={item.id}>{item.name} <strong>+{progress.pointsByTeam[item.id]} pts</strong></span>)}{Object.keys(progress.pointsByTeam).length === 0 && <span>No points awarded.</span>}</div>
      </div> : <>
        <div className="connections-play-grid">
          {progress.solved.map(index => groupRow(index, true))}
          {progress.order.filter(tile => !progress.solved.includes(Math.floor(tile / 4))).map(tile => <button key={tile} className={`connections-tile${selected.includes(tile) ? " selected" : ""}`} aria-pressed={selected.includes(tile)} disabled={!selected.includes(tile) && selected.length === 4} onClick={() => setSelected(previous => {
            const remaining = previous.filter(value => !progress.solved.includes(Math.floor(value / 4)));
            return remaining.includes(tile) ? remaining.filter(value => value !== tile) : remaining.length < 4 ? [...remaining, tile] : remaining;
          })}>{words[tile]}</button>)}
        </div>
        <div className="connections-status" role="status">{attempted ? "Already tried that combination. Swap a tile to try again." : (progress.feedback === "Three are correct" ? "Not a connection. That guess uses a mistake." : progress.feedback) || "Choose four tiles that belong together."}</div>
      </>}
    </div>
    <footer className="question-modal-actions connections-actions">
      <span>{progress.solved.length}/{required} found · {limit ? `${Math.max(0, limit - progress.mistakes)} mistakes left` : `${progress.mistakes} mistakes`}</span>
      <div>{progress.finished ? <>{!finishedRevealing && <button className="button ghost" onClick={() => setRevealed(remainingGroups.length)}>Reveal all now</button>}<button className="button" disabled={!finishedRevealing} onClick={onContinue}>Continue</button></> : <>
        {progress.started && <><button className="button ghost" onClick={() => { setSelected([]); onAction({ type: "shuffle" }); }}>Shuffle</button><button className="button ghost" disabled={!selected.length} onClick={() => setSelected([])}>Clear</button><button className="button" disabled={selected.length !== 4 || attempted} onClick={() => onAction({ type: "guess", tiles: selected })}>Submit group</button></>}
        <button className="button ghost" onClick={() => { if (window.confirm("End this round and reveal the remaining connections? Earned points will be kept.")) onAction({ type: "end" }); }}>End round</button>
      </>}</div>
    </footer>
  </article>;
}
