'use client';

import type { Question, Team } from "@/lib/types";

type Props = {
  question: Question;
  teams: Team[];
  currentTeamName?: string;
  answeringTeamName?: string;
  onClose: () => void;
  onRevealAnswer: () => void;
  showAnswer: boolean;
  onCorrect: () => void;
  onWrong: () => void;
  disableActions?: boolean;
  flashKey?: number;
};

export function StandardModal({
  question,
  teams,
  currentTeamName,
  answeringTeamName,
  onClose,
  onRevealAnswer,
  showAnswer,
  onCorrect,
  onWrong,
  disableActions,
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
                {question.category} · Standard
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
          <div style={{ fontSize: "2.2rem", lineHeight: 1.35 }}>
            {question.prompt || "No clue entered yet."}
          </div>
          {question.imageData && (
            <div
              style={{
                marginTop: "12px",
                borderRadius: "12px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <img
                src={question.imageData}
                alt={question.imageName || "Question image"}
                style={{
                  width: "100%",
                  maxHeight: "520px",
                  height: "auto",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>
          )}
          <div
            style={{
              marginTop: "18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <button className="button ghost" onClick={onClose}>
              Close
            </button>
            <button className="button primary" onClick={onRevealAnswer}>
              Reveal answer
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
          <div style={{ marginBottom: "12px" }}>
            <div
              style={{
                textTransform: "uppercase",
                color: "var(--muted)",
                letterSpacing: "0.05em",
                fontWeight: 800,
              }}
            >
              {question.category} · Standard
            </div>
            <div style={{ fontWeight: 800, fontSize: "2rem", marginTop: "6px" }}>
              {question.points} pts
            </div>
          </div>
          <div style={{ fontSize: "2rem", lineHeight: 1.4, fontWeight: 800 }}>
            <div
              style={{
                color: "var(--muted)",
                marginBottom: "6px",
                fontSize: "1.05rem",
                fontWeight: 600,
              }}
            >
              Answer
            </div>
            <div style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
              {question.answer || "No answer provided."}
            </div>
          </div>
          {question.answerImageData && (
            <div
              style={{
                marginTop: "14px",
                borderRadius: "12px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <img
                src={question.answerImageData}
                alt={question.answerImageName || "Answer image"}
                style={{
                  width: "100%",
                  maxHeight: "520px",
                  height: "auto",
                  objectFit: "contain",
                  display: "block",
                }}
              />
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
    </>
  );
}
