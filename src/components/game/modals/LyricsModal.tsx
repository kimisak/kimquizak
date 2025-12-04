'use client';

import type { Question, Team } from "@/lib/types";

type Props = {
  question: Question;
  teams: Team[];
  lyricsRevealed: boolean[];
  isRed: (idx: number) => boolean;
  onRevealLine: (idx: number) => void;
  onRevealAll: () => void;
  allRevealed: boolean;
  onRevealAnswer: () => void;
  showAnswer: boolean;
  currentTeamName?: string;
  answeringTeamName?: string;
  answerVideoUrl?: string | null;
  onCorrect: () => void;
  onWrong: () => void;
  disableActions?: boolean;
  onClose: () => void;
  flashKey?: number;
};

export function LyricsModal({
  question,
  lyricsRevealed,
  isRed,
  onRevealLine,
  onRevealAll,
  allRevealed,
  onRevealAnswer,
  showAnswer,
  currentTeamName,
  answeringTeamName,
  answerVideoUrl,
  onCorrect,
  onWrong,
  disableActions,
  onClose,
  flashKey,
}: Props) {
  return (
    <>
      <div
        className={`flip-inner ${showAnswer ? "flipped" : ""}`}
        style={{
          position: "relative",
          width: "100%",
          minHeight: "360px",
          transformStyle: "preserve-3d",
          transition: "transform 0.5s ease",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
          }}
        >
          <div
            className="card"
            style={{
              padding: "22px",
              background: "rgba(10, 12, 18, 0.96)",
              borderColor: "rgba(255,255,255,0.18)",
              position: "relative",
              overflow: "hidden",
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
                TEXT GRID · {question.category}
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 800 }}>
                {question.points} pts
              </div>
              {answeringTeamName && (
                <div style={{ color: "var(--muted)", marginTop: "2px", fontSize: "0.95rem" }}>
                  Answering: <strong style={{ color: "#81e6d9" }}>{answeringTeamName}</strong>
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "10px",
            }}
          >
            {(question.lyricsSegments ?? []).map((line, idx) => {
              const revealed = lyricsRevealed[idx];
              const red = isRed(idx);
              return (
                <button
                  key={idx}
                  onClick={() => onRevealLine(idx)}
                  className={`lyrics-tile ${revealed ? "revealed" : "concealed"}`}
                  style={{
                    minHeight: "80px",
                    borderRadius: "12px",
                    border: revealed
                      ? red
                        ? "1px solid rgba(207,45,45,0.8)"
                        : "1px solid rgba(28,111,77,0.7)"
                      : "1px solid rgba(255,255,255,0.12)",
                    background: revealed
                      ? red
                        ? "linear-gradient(135deg, rgba(207,45,45,0.6), rgba(146,26,26,0.8))"
                        : "rgba(28,111,77,0.18)"
                      : "rgba(255,255,255,0.08)",
                    color: revealed ? "#f5f3ef" : "var(--foreground)",
                    fontWeight: 700,
                    fontSize: revealed ? "1.2rem" : "1rem",
                    padding: "12px",
                    textAlign: "center",
                    cursor: revealed ? "default" : "pointer",
                    animation: revealed && red ? "boom 450ms ease-out" : undefined,
                  }}
                  disabled={revealed}
                >
                  {revealed ? line || "(blank)" : idx + 1}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
            <button
              className="button ghost"
              onClick={onRevealAll}
              disabled={allRevealed}
              style={{ opacity: allRevealed ? 0.6 : 1 }}
            >
              Reveal all lines
            </button>
          </div>
          <div
            style={{
              marginTop: "18px",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
            }}
          >
            <button className="button primary" onClick={onRevealAnswer}>
              Reveal answer
            </button>
            <button className="button ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          backfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
        }}
      >
        <div
          className="card"
          style={{
            padding: "22px",
            background: "rgba(10, 14, 19, 0.96)",
            borderColor: "rgba(255,255,255,0.2)",
          }}
        >
          <div
            style={{
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                textTransform: "uppercase",
                color: "var(--muted)",
                letterSpacing: "0.05em",
                fontWeight: 800,
              }}
            >
              TEXT GRID · {question.category}
            </div>
            <div style={{ fontWeight: 800, fontSize: "2rem", marginTop: "6px" }}>
              {question.points} pts
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ color: "var(--muted)", fontSize: "1rem" }}>
              Answer
            </div>
            <div
              style={{
                fontWeight: 800,
                fontSize: "2rem",
                lineHeight: 1.4,
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            >
              {question.answer || "No answer provided."}
            </div>
            {answerVideoUrl && (
              <div
                style={{
                  borderRadius: "12px",
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  marginTop: "8px",
                }}
              >
                <iframe
                  src={answerVideoUrl}
                  style={{ width: "100%", height: "240px", border: "0" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            {question.lyricsSegments && question.lyricsSegments.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: "10px",
                }}
              >
                {question.lyricsSegments.map((line, idx) => (
                  <div
                    key={idx}
                    style={{
                      borderRadius: "12px",
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.05)",
                      padding: "12px",
                      fontWeight: 700,
                      fontSize: "1.1rem",
                      textAlign: "center",
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}
            <div
              style={{
                marginTop: "18px",
                display: "grid",
                gap: "10px",
              }}
            >
              {answeringTeamName && (
                <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
                  Answered by: <strong style={{ color: "#81e6d9" }}>{answeringTeamName}</strong>
                </div>
              )}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  className="button secondary"
                  onClick={onCorrect}
                  disabled={disableActions}
                  style={{ opacity: disableActions ? 0.6 : 1 }}
                >
                  ✓ Correct
                </button>
                <button
                  className="button ghost"
                  onClick={onWrong}
                  disabled={disableActions}
                  style={{ opacity: disableActions ? 0.6 : 1 }}
                >
                  ✕ Wrong
                </button>
                <button className="button ghost" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
