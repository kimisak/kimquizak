'use client';

import type { Question, Team } from "@/lib/types";
import { TeamPill } from "@/components/game/TeamPill";

type Props = {
  question: Question;
  teams: Team[];
  currentTeamName?: string;
  answeringTeamName?: string;
  answeringTeamColor?: string;
  answeringTeamEmoji?: string | null;
  mapLocked: boolean;
  onToggleLock: () => void;
  onClose: () => void;
  onRevealAnswer: () => void;
  showAnswer: boolean;
  onCorrect: () => void;
  onWrong: () => void;
  disableActions?: boolean;
  countdownSeconds?: number | null;
  flashKey?: number;
  timerUsed?: boolean;
};

export function GeoguesserModal({
  question,
  currentTeamName,
  answeringTeamName,
  answeringTeamColor,
  answeringTeamEmoji,
  mapLocked,
  onToggleLock,
  onClose,
  onRevealAnswer,
  showAnswer,
  onCorrect,
  onWrong,
  disableActions,
  countdownSeconds,
  flashKey,
  timerUsed,
}: Props) {
  const lockDisabled = timerUsed ? true : !mapLocked && countdownSeconds !== null;
  const unlockCost = question.geoUnlockCost ?? 0;
  const unlockDuration = question.geoTimerSeconds ?? 10;
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
              position: "relative",
              zIndex: 1,
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
                {question.category} · Geoguesser
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 800 }}>
                {question.points} pts
              </div>
              {answeringTeamName && !showAnswer && (
                <TeamPill
                  label="Answering"
                  name={answeringTeamName}
                  color={answeringTeamColor}
                  emoji={answeringTeamEmoji}
                />
              )}
            </div>
            {question.mapEmbedUrl && (
              <div style={{ display: "grid", gap: "6px", justifyItems: "end" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
                    {mapLocked ? "Map locked (view only)" : "Map unlocked · move now"}
                    {!mapLocked && countdownSeconds !== null && (
                      <strong style={{ color: "#f7c948", marginLeft: "8px" }}>
                        {countdownSeconds}s
                      </strong>
                    )}
                  </div>
                  <button
                    className="button ghost"
                    onClick={onToggleLock}
                    disabled={lockDisabled}
                    style={{
                      opacity: lockDisabled ? 0.7 : 1,
                      cursor: lockDisabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {mapLocked ? "Unlock map" : "Lock map"}
                  </button>
                </div>
                <div style={{ color: "var(--muted)", fontSize: "0.9rem", textAlign: "right" }}>
                  {unlockCost > 0 ? (
                    <>
                      Unlocking caps the reward by <strong style={{ color: "#f7c948" }}>{unlockCost} pts</strong> and adds the same{" "}
                      <strong style={{ color: "#f7c948" }}>{unlockCost} pts</strong> to the penalty if wrong. Map opens for{" "}
                      <strong style={{ color: "#f7c948" }}>{unlockDuration}s</strong>.
                    </>
                  ) : (
                    <>
                      Unlocking opens the map for <strong style={{ color: "#f7c948" }}>{unlockDuration}s</strong>.
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          {question.prompt && (
            <div style={{ fontSize: "1.4rem", lineHeight: 1.45, marginBottom: "10px" }}>
              {question.prompt}
            </div>
          )}
              {question.mapEmbedUrl ? (
            <div
              style={{
                position: "relative",
                borderRadius: "14px",
                overflow: "visible",
                height: "420px",
                boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
                zIndex: 1,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  borderRadius: "14px",
                  border: "1px solid rgba(255,255,255,0.05)",
                  background: "rgba(255,255,255,0.015)",
                }}
              >
                <iframe
                  src={question.mapEmbedUrl}
                  style={{
                    width: "100%",
                    height: "900px",
                    border: "0",
                    marginTop: "-220px",
                    pointerEvents: mapLocked ? "none" : "auto",
                  }}
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "14px",
                borderRadius: "12px",
                border: "1px dashed rgba(255,255,255,0.2)",
                color: "var(--muted)",
              }}
            >
              No Street View embed URL provided.
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
            position: "relative",
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
              {question.category} · Geoguesser
            </div>
            <div style={{ fontWeight: 800, fontSize: "2rem", marginTop: "6px" }}>
              {question.points} pts
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: question.answerImageData ? "1fr 1fr" : "1fr",
              gap: "16px",
              alignItems: "start",
              marginTop: "6px",
            }}
          >
            <div>
              <div
                style={{
                  color: "var(--muted)",
                  marginBottom: "6px",
                  fontSize: "1rem",
                }}
              >
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
              {question.answerLocationUrl && (
                <a
                  href={question.answerLocationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="button ghost"
                  style={{ marginTop: "10px", display: "inline-flex" }}
                >
                  Open in Google Maps
                </a>
              )}
              {question.mapEmbedUrl && (
                <div
                  style={{
                    marginTop: "12px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.12)",
                    height: "420px",
                    position: "relative",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <iframe
                    src={question.mapEmbedUrl}
                    style={{
                      width: "100%",
                      height: "900px",
                      border: "0",
                      marginTop: "-220px",
                      pointerEvents: "auto",
                    }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation"
                  />
                </div>
              )}
            </div>
            {question.answerImageData && (
              <div
                style={{
                  borderRadius: "12px",
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  display: "grid",
                  placeItems: "center",
                  padding: "6px",
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
          </div>
          <div
            style={{
              marginTop: "18px",
              display: "grid",
              gap: "10px",
            }}
          >
            {answeringTeamName && (
              <TeamPill
                label="Answered by"
                name={answeringTeamName}
                color={answeringTeamColor}
                emoji={answeringTeamEmoji}
              />
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
      <style jsx>{`
        @keyframes shadowFlash {
          0% {
            box-shadow: 0 0 0 12px rgba(255, 255, 255, 0.55), 0 0 36px 18px rgba(255, 255, 255, 0.45);
          }
          60% {
            box-shadow: 0 0 20px 6px rgba(255, 255, 255, 0.2);
          }
          100% {
            box-shadow: 0 0 20px 6px rgba(255, 255, 255, 0);
          }
        }
      `}</style>
    </>
  );
}
