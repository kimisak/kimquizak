'use client';

import type { Question, Team } from "@/lib/types";

export type JokerRound = {
  numbers: number[];
  targets: number[];
  correctDirs: ("above" | "below")[];
  jokerIndex: number;
  jokerPosition: "above" | "below";
  increment: number;
};

export type JokerResult = "pending" | "correct" | "wrong" | "joker";

export type JokerProgress = {
  currentIndex: number;
  results: JokerResult[];
  score: number;
  finished: boolean;
  chosenPositions: ("above" | "below" | null)[];
};

type Props = {
  question: Question;
  teams: Team[];
  currentTeamName?: string;
  answeringTeamName?: string;
  round: JokerRound;
  progress: JokerProgress;
  onGuess: (position: "above" | "below") => void;
  onFinish: () => void;
  onClose: () => void;
  disableActions?: boolean;
  maxScore: number;
  rotateInfo?: boolean;
  incrementInfo?: number;
};

const statusColors: Record<JokerResult, string> = {
  pending: "rgba(255,255,255,0.1)",
  correct: "linear-gradient(135deg, #1c6f4d, #0f5a3c)",
  wrong: "linear-gradient(135deg, #b91c1c, #7f1d1d)",
  joker: "linear-gradient(135deg, #f59e0b, #f97316)",
};

const statusBorder: Record<JokerResult, string> = {
  pending: "rgba(255,255,255,0.16)",
  correct: "rgba(28,111,77,0.9)",
  wrong: "rgba(185,28,28,0.8)",
  joker: "rgba(249,115,22,0.9)",
};

export function JokerModal({
  question,
  answeringTeamName,
  round,
  progress,
  onGuess,
  onFinish,
  onClose,
  disableActions,
  maxScore,
  rotateInfo,
  incrementInfo,
}: Props) {
  const total = round.numbers.length;
  const activeIndex = total - 1 - progress.currentIndex; // start from rightmost
  const canGuess = !progress.finished && !disableActions;
  const guessesLeft = progress.finished ? 0 : Math.max(total - progress.currentIndex, 0);
  const foundJoker = progress.results.includes("joker");

  const renderGuessCircle = (position: "above" | "below", idx: number) => {
    const isActive = idx === activeIndex && canGuess;
    const status = progress.results[idx] ?? "pending";
    const isJokerSpot = status === "joker";
    const chosen = progress.chosenPositions[idx] === position;
    const displayStatus = chosen ? (isJokerSpot ? "joker" : status) : "pending";
    const revealNumber = chosen && status !== "pending";

    const canHover = isActive && !chosen && !progress.finished;

    return (
      <button
        key={`${idx}-${position}`}
        className={`joker-guess ${canHover ? "joker-hoverable" : ""}`}
        onClick={() => onGuess(position)}
        disabled={!isActive}
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          border: `2px solid ${statusBorder[displayStatus]}`,
          background: statusColors[displayStatus],
          color: "#f8fafc",
          cursor: isActive ? "pointer" : "not-allowed",
          transform: isActive ? "scale(1.02)" : "scale(1)",
          transition: "transform 140ms ease, border-color 140ms ease, background 140ms ease",
          boxShadow: isActive
            ? "0 0 0 6px rgba(255,255,255,0.06)"
            : "none",
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          letterSpacing: "0.02em",
          position: "relative",
        }}
      >
        {revealNumber ? (isJokerSpot ? "🎩" : round.targets[idx]) : ""}
      </button>
    );
  };

  return (
    <div
      className="card"
      style={{
        padding: "20px",
        background: "rgba(10, 12, 18, 0.96)",
        borderColor: "rgba(255,255,255,0.18)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          marginBottom: "12px",
          gap: "10px",
        }}
      >
        <div style={{ flex: 1, display: "grid", gap: "4px" }}>
          <div
            style={{
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--muted)",
            }}
          >
            {question.category} · Joker
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800 }}>
            {question.points} pts
          </div>
          {answeringTeamName && (
            <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
              Guessing: <strong style={{ color: "#f2c14f" }}>{answeringTeamName}</strong>
            </div>
          )}
        </div>
        <div style={{ textAlign: "center", justifySelf: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 10px",
              borderRadius: "999px",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))",
              border: "1px solid rgba(255,255,255,0.2)",
              boxShadow: "0 0 20px rgba(255,215,0,0.18), 0 0 0 4px rgba(255,255,255,0.06)",
              animation: "joker-glow 2.2s ease-in-out infinite",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 900,
              margin: "0 auto",
            }}
          >
            <span role="img" aria-label="sparkles">
              ✨
            </span>
            Joker Round
            <span role="img" aria-label="sparkles">
              ✨
            </span>
          </div>
        </div>
          <div
            style={{
              borderRadius: "12px",
              padding: "10px 12px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              display: "grid",
              gap: "4px",
              minWidth: "180px",
              justifySelf: "end",
            }}
          >
            <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              Current potential
            </div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>
              {progress.score} / {maxScore}
            </div>
            <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              Guesses left: {guessesLeft}
            </div>
            {incrementInfo !== undefined && (
              <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                +/- {incrementInfo} per guess
              </div>
            )}
            <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              {rotateInfo ? "Wrong guesses: next team" : "Wrong guesses: same team"}
            </div>
          </div>
      </div>

      {question.prompt && (
        <div
          style={{
            marginBottom: "14px",
            color: "#e2e8f0",
            fontSize: "1.05rem",
            lineHeight: 1.4,
          }}
        >
          {question.prompt}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${total}, minmax(72px, 1fr))`,
          gap: "10px",
        }}
      >
        {round.numbers.map((num, idx) => (
          <div
            key={idx}
            style={{
              display: "grid",
              gridTemplateRows: "auto auto auto",
              justifyItems: "center",
              gap: "8px",
            }}
          >
            {renderGuessCircle("above", idx)}
            <div
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.2)",
                background: "radial-gradient(circle, rgba(255,255,255,0.12), rgba(255,255,255,0.06))",
                display: "grid",
                placeItems: "center",
                fontSize: "1.6rem",
                fontWeight: 800,
                color: "#f8fafc",
                boxShadow:
                  progress.results[idx] !== "pending"
                    ? "0 0 0 6px rgba(255,255,255,0.05)"
                    : "none",
              }}
            >
              {num}
            </div>
            {renderGuessCircle("below", idx)}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "14px",
          color: "var(--muted)",
          fontSize: "0.95rem",
        }}
      >
        Pick higher (top) or lower (bottom) for each number. A hidden 🎩 Joker awards the max score instantly.
      </div>

      <div
        style={{
          marginTop: "16px",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <button
          className="button secondary"
          onClick={onFinish}
          disabled={!progress.finished || disableActions}
          style={{ opacity: !progress.finished || disableActions ? 0.6 : 1 }}
        >
          Apply score{answeringTeamName ? ` to ${answeringTeamName}` : ""}
        </button>
        <button className="button ghost" onClick={onClose}>
          Close
        </button>
        {foundJoker && (
          <span style={{ color: "#f2c14f", fontWeight: 700 }}>
            Joker found! Max score locked in.
          </span>
        )}
      </div>

      {progress.finished && question.answer && (
        <div
          style={{
            marginTop: "12px",
            padding: "12px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.05)",
            color: "#e2e8f0",
            fontWeight: 700,
          }}
        >
          {question.answer}
        </div>
      )}
      <style jsx global>{`
        @keyframes joker-glow {
          0% {
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.18), 0 0 0 4px rgba(255, 255, 255, 0.06);
            transform: translateY(0);
          }
          50% {
            box-shadow: 0 0 28px rgba(255, 215, 0, 0.32), 0 0 0 6px rgba(255, 255, 255, 0.08);
            transform: translateY(-1px);
          }
          100% {
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.18), 0 0 0 4px rgba(255, 255, 255, 0.06);
            transform: translateY(0);
          }
        }
        @keyframes joker-hover-wiggle {
          0% {
            transform: translateY(0) rotate(0deg);
          }
          20% {
            transform: translateY(-1px) rotate(-0.8deg);
          }
          40% {
            transform: translateY(1px) rotate(0.8deg);
          }
          60% {
            transform: translateY(-2px) rotate(-1deg);
          }
          80% {
            transform: translateY(1px) rotate(0.6deg);
          }
          100% {
            transform: translateY(0) rotate(0deg);
          }
        }
        .joker-hoverable:not(:disabled):hover {
          animation: joker-hover-wiggle 1.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
