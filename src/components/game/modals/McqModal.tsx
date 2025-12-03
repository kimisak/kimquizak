'use client';

import { useMemo } from "react";
import type { Question, Team } from "@/lib/types";

type Props = {
  question: Question;
  teams: Team[];
  currentTeamName?: string;
  answeringTeamName?: string;
  eliminated: number[];
  onSelect: (idx: number) => void;
  onClose: () => void;
};

export function McqModal({
  question,
  currentTeamName,
  answeringTeamName,
  eliminated,
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
      <div style={{ display: "grid", gap: "10px" }}>
        {options.map((opt, idx) => {
          const disabled = eliminated.includes(idx);
          const bg = optionColors[idx] ?? "rgba(255,255,255,0.08)";
          return (
            <button
              key={idx}
              className="button secondary"
              disabled={disabled}
              onClick={() => onSelect(idx)}
              style={{
                justifyContent: "flex-start",
                opacity: disabled ? 0.6 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
                fontSize: "1.05rem",
                background: disabled
                  ? "rgba(255,255,255,0.08)"
                  : `linear-gradient(135deg, ${bg}, rgba(255,255,255,0.12))`,
                border: "1px solid rgba(255,255,255,0.18)",
                boxShadow: disabled ? "none" : "0 10px 24px rgba(0,0,0,0.35)",
                color: "#0b0d13",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  minWidth: "26px",
                  textAlign: "center",
                  borderRadius: "999px",
                  padding: "4px 8px",
                  background: bg,
                  marginRight: "10px",
                  fontWeight: 800,
                  color: "#0b0d13",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}
              >
                {String.fromCharCode(65 + idx)}
              </span>
              {opt || "(empty option)"}
            </button>
          );
        })}
      </div>
      <div style={{ color: "var(--muted)", marginTop: "12px", fontSize: "0.95rem" }}>
        Wrong answers pass to the next team. First correct wins the points.
      </div>
    </div>
  );
}
