'use client';

import { useState, type CSSProperties } from "react";
import type { ScoreTransaction, Team } from "@/lib/types";
import { getTeamAccent, getTeamMarker } from "@/lib/teamPresentation";

type Props = {
  teams: Team[];
  onAdjust: (teamId: string, delta: number, reason?: string) => void;
  onSet: (teamId: string, value: number) => void;
  history?: ScoreTransaction[];
  onUndo?: (transactionId: string) => void;
  compact?: boolean;
  currentTeamId?: string;
};

export function Leaderboard({ teams, onAdjust, onSet, history = [], onUndo, compact = false, currentTeamId }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const podiumMarkers = ["🥇", "🥈", "🥉"];

  return (
    <section className={`card scoreboard${compact ? " compact" : ""}`} style={{ padding: compact ? "12px" : "18px" }}>
      <div
        className="scoreboard-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
          gap: "10px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: compact ? "1.2rem" : undefined }}>{compact ? "Podium" : "Scores"}</h2>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            className="button ghost compact"
            type="button"
            onClick={() => {
              setShowHistory((value) => !value);
            }}
          >
            {showHistory ? "Hide history" : `History${history.length ? ` (${history.length})` : ""}`}
          </button>
        </div>
      </div>
      {teams.length === 0 ? (
        <div style={{ color: "var(--muted)" }}>
          Add teams first in the Teams page.
        </div>
      ) : (
        <div className="scoreboard-list">
          {teams.map((team, idx) => {
            const accent = getTeamAccent(team);
            const marker = getTeamMarker(team);
            const isCurrentTurn = team.id === currentTeamId;

            return (
              <div
                key={team.id}
                className={`card scoreboard-team${isCurrentTurn ? " current" : ""}`}
                data-emoji-surface={accent.emojiSurface}
                style={{
                  "--team-accent": accent.onLight,
                  "--team-base": accent.base,
                  "--team-tint": accent.tint,
                  "--team-glow": accent.glow,
                } as CSSProperties}
              >
                <div
                  className="scoreboard-rank"
                  style={{
                    width: compact && idx === 0 ? "42px" : compact ? "36px" : "42px",
                    height: compact && idx === 0 ? "42px" : compact ? "36px" : "42px",
                    borderRadius: "12px",
                    background: `${accent.base}`,
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    color: "#f8fafc",
                    border: `1px solid ${accent.glow}55`,
                    boxShadow: `0 3px 10px ${accent.base}45`,
                  }}
              >
                {podiumMarkers[idx] ?? `#${idx + 1}`}
              </div>
              <div className="scoreboard-identity" style={{ display: "grid", gap: compact ? "2px" : "6px", minWidth: compact ? 0 : "180px", flex: 1 }}>
                <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className="scoreboard-team-pill team-identity-surface"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: compact ? "4px 8px" : "6px 10px",
                        borderRadius: "999px",
                        background: `${accent.base}22`,
                        border: `2px solid ${accent.base}55`,
                        color: "#f8fafc",
                        fontWeight: 900,
                        letterSpacing: "0.01em",
                        boxShadow: `0 1px 6px ${accent.base}44`,
                      }}
                    >
                      <span className="scoreboard-team-emoji team-identity-emoji" aria-hidden>{marker}</span>
                      <span className="scoreboard-team-name">{team.name}</span>
                      {isCurrentTurn && <span className="turn-badge">TURN</span>}
                    </span>
                  </div>
                  {!compact && <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.95rem",
                      display: "flex",
                      gap: "6px",
                      flexWrap: "wrap",
                    }}
                  >
                    {team.players.map((p) => p.name.trim()).filter(Boolean).join(", ")}
                  </div>}
                </div>
                <div className="scoreboard-controls" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginLeft: "auto", justifyContent: "flex-end" }}>
                  <button className="button ghost compact" type="button" onClick={() => onAdjust(team.id, -100)}>−100</button>
                  <div style={{ position: "relative" }}>
                    <input
                      key={`${team.id}-${team.score}`}
                      type="number"
                      defaultValue={team.score}
                      aria-label={`Set score for ${team.name}`}
                      onBlur={(event) => onSet(team.id, Number(event.target.value))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                      style={{
                        width: "116px",
                        padding: "7px 30px 7px 8px",
                        borderRadius: "10px",
                        border: `1px solid ${accent.base}80`,
                        background: "rgba(255,255,255,0.07)",
                        color: "#f8fafc",
                        textAlign: "right",
                        fontSize: compact && idx === 0 ? "1.45rem" : "1.2rem",
                        fontWeight: 900,
                      }}
                    />
                    <span style={{ position: "absolute", right: "7px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: "0.62rem", fontWeight: 800, pointerEvents: "none" }}>PTS</span>
                  </div>
                  <button className="button ghost compact" type="button" onClick={() => onAdjust(team.id, 100)}>+100</button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={customAmounts[team.id] ?? ""}
                    onChange={(event) => setCustomAmounts((previous) => ({ ...previous, [team.id]: event.target.value }))}
                    placeholder="Bonus / correction"
                    aria-label={`Custom score adjustment for ${team.name}`}
                    style={{ width: "145px", padding: "8px", borderRadius: "10px", border: `1px solid ${accent.base}65`, background: "rgba(255,255,255,0.07)", color: "var(--foreground)" }}
                  />
                  <button
                    className="button secondary compact"
                    type="button"
                    disabled={!Number(customAmounts[team.id])}
                    onClick={() => {
                      const amount = Number(customAmounts[team.id]);
                      if (!Number.isFinite(amount) || amount === 0) return;
                      onAdjust(team.id, amount, "Host bonus / correction");
                      setCustomAmounts((previous) => ({ ...previous, [team.id]: "" }));
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showHistory && (
        <div
          className="scoreboard-history"
          style={{
            margin: compact ? "14px auto 0" : "14px 0 0",
            maxWidth: compact ? "1120px" : undefined,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: "12px",
            display: "grid",
            gap: "8px",
          }}
        >
          <div className="scoreboard-history-intro" style={{ fontSize: "0.9rem" }}>
            Every automatic score and host correction is recorded. Undo reverses only that entry.
          </div>
          {history.length === 0 ? (
            <div className="scoreboard-history-empty">No score changes yet.</div>
          ) : (
            history.slice(0, 12).map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  padding: "9px 10px",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong>{entry.teamName}</strong>{" "}
                  <span style={{ color: entry.delta >= 0 ? "#6ee7b7" : "#fca5a5", fontWeight: 800 }}>
                    {entry.delta >= 0 ? "+" : ""}{entry.delta}
                  </span>
                  <div className="scoreboard-history-reason" style={{ fontSize: "0.85rem", overflowWrap: "anywhere" }}>
                    {entry.reason}
                  </div>
                </div>
                <button
                  className="button ghost compact"
                  type="button"
                  onClick={() => onUndo?.(entry.id)}
                >
                  Undo
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
