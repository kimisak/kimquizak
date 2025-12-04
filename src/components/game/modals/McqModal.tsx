'use client';

import { useMemo } from "react";
import type { Question, Team } from "@/lib/types";
import { TeamPill } from "@/components/game/TeamPill";

type Props = {
  question: Question;
  teams: Team[];
  currentTeamName?: string;
  answeringTeamName?: string;
  currentTeamColor?: string;
  answeringTeamColor?: string;
  currentTeamEmoji?: string | null;
  answeringTeamEmoji?: string | null;
  eliminated: number[];
  resolved?: boolean;
  correctIndex?: number;
  resolvedInfo?: { teamName: string; points: number } | null;
  onSelect: (idx: number) => void;
  onClose: () => void;
};

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
  onClose,
}: Props) {
  const rawOptions = question.mcqOptions?.slice(0, 4) ?? [];
  const hasFour =
    rawOptions.length >= 4 && rawOptions.slice(2).some((o) => (o ?? "").trim() !== "");
  const optionCount = hasFour ? 4 : Math.min(2, Math.max(2, rawOptions.length || 2));
  const options = rawOptions.slice(0, optionCount);
  const palette = ["#d94444", "#2c9b61", "#8a5adf", "#f2c14f"];
  const optionColors = useMemo(() => {
    const arr = [...palette];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, options.length);
  }, [question.id, options.length]);

  return (
    <div
      className="card"
      style={{
        padding: "22px",
        background: "rgba(10, 12, 18, 0.96)",
        borderColor: "rgba(255,255,255,0.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <div>
          <div
            style={{
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--muted)",
            }}
          >
            {question.category} · Multiple choice
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800 }}>
            {question.points} pts
          </div>
          {answeringTeamName && (
            <TeamPill label="Answering" name={answeringTeamName} color={answeringTeamColor} emoji={answeringTeamEmoji} />
          )}
          {currentTeamName && !answeringTeamName && (
            <TeamPill label="Current" name={currentTeamName} color={currentTeamColor} emoji={currentTeamEmoji} />
          )}
        </div>
        <button className="button ghost" onClick={onClose}>
          Close
        </button>
      </div>
      {question.prompt && (
        <div style={{ fontSize: "1.35rem", lineHeight: 1.45, marginBottom: "16px" }}>
          {question.prompt}
        </div>
      )}
      <div
        style={{
          display: "grid",
          gap: "12px",
          gridTemplateColumns: options.length === 4 ? "repeat(2, minmax(0,1fr))" : "1fr",
        }}
      >
        {options.map((opt, idx) => {
          const disabled = eliminated.includes(idx);
          const isCorrect = resolved && idx === correctIndex;
          const bg = optionColors[idx] ?? "rgba(255,255,255,0.08)";
          const isResolvedWrong = resolved && idx !== correctIndex;
          return (
            <button
              key={idx}
              className="button secondary"
              disabled={disabled || resolved}
              onClick={() => onSelect(idx)}
              style={{
                justifyContent: "flex-start",
                alignItems: "stretch",
                opacity: disabled ? 0.6 : isResolvedWrong ? 0.45 : 1,
                cursor: disabled || resolved ? "not-allowed" : "pointer",
                fontSize: "1.2rem",
                gap: "12px",
                padding: 0,
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${bg}`,
                boxShadow: disabled ? "none" : "0 10px 24px rgba(0,0,0,0.35)",
                color: "#fdfdfd",
                overflow: "hidden",
                outline: isCorrect ? `2px solid #6ee7b7` : undefined,
                minHeight: "82px",
                filter: isResolvedWrong ? "grayscale(0.15)" : "none",
              }}
            >
              <span
                style={{
                  display: "grid",
                  placeItems: "center",
                  minWidth: "56px",
                  textAlign: "center",
                  borderRadius: "0",
                  padding: "0 10px",
                  background: bg,
                  borderRight: `1px solid rgba(0,0,0,0.2)`,
                  fontWeight: 800,
                  color: "#0b0d13",
                }}
              >
                {String.fromCharCode(65 + idx)}
              </span>
              <span
                style={{
                  padding: "16px 18px",
                  flex: 1,
                  textAlign: "left",
                  background: "rgba(255,255,255,0.04)",
                  lineHeight: 1.4,
                }}
              >
                {opt || "(empty option)"}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ color: "var(--muted)", marginTop: "12px", fontSize: "0.95rem" }}>
        {resolved ? (
          <span
            style={{
              fontWeight: 700,
              color: resolvedInfo && resolvedInfo.points < 0 ? "#f87171" : "#6ee7b7",
            }}
          >
            {resolvedInfo
              ? `${resolvedInfo.points >= 0 ? "Correct" : "Wrong"}! ${resolvedInfo.teamName} ${
                  resolvedInfo.points >= 0 ? "+" : ""
                }${resolvedInfo.points} pts`
              : "Close when ready."}
          </span>
        ) : options.length === 4 ? (
          "Wrong answers pass to the next team. First correct wins the points."
        ) : (
          "Two-option mode: a wrong answer ends the question and costs points."
        )}
      </div>
    </div>
  );
}
