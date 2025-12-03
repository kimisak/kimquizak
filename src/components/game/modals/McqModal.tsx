'use client';

import { useMemo } from "react";
import type { Question, Team } from "@/lib/types";

type Props = {
  question: Question;
  teams: Team[];
  currentTeamName?: string;
  answeringTeamName?: string;
  eliminated: number[];
  resolved?: boolean;
  correctIndex?: number;
  onSelect: (idx: number) => void;
  onClose: () => void;
};

export function McqModal({
  question,
  currentTeamName,
  answeringTeamName,
  eliminated,
  resolved = false,
  correctIndex = 0,
  onSelect,
  onClose,
}: Props) {
  const options = question.mcqOptions?.slice(0, 4) ?? [];
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
            <div
              style={{
                color: "var(--muted)",
                marginTop: "2px",
                fontSize: "0.95rem",
              }}
            >
              Answering: <strong style={{ color: "#81e6d9" }}>{answeringTeamName}</strong>
            </div>
          )}
          {currentTeamName && !answeringTeamName && (
            <div style={{ color: "var(--muted)", marginTop: "2px" }}>
              Current: <strong style={{ color: "#f2c14f" }}>{currentTeamName}</strong>
            </div>
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
          return (
            <button
              key={idx}
              className="button secondary"
              disabled={disabled || resolved}
              onClick={() => onSelect(idx)}
              style={{
                justifyContent: "flex-start",
                alignItems: "stretch",
                opacity: disabled ? 0.6 : 1,
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
          <span style={{ color: "#6ee7b7", fontWeight: 700 }}>Correct! Close when ready.</span>
        ) : (
          "Wrong answers pass to the next team. First correct wins the points."
        )}
      </div>
    </div>
  );
}
