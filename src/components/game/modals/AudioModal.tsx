'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import type { Question } from "@/lib/types";
import { TeamPill } from "@/components/game/TeamPill";

type Props = {
  question: Question;
  currentTeamName?: string;
  currentTeamColor?: string;
  currentTeamEmoji?: string | null;
  answeringTeamName?: string;
  answeringTeamColor?: string;
  answeringTeamEmoji?: string | null;
  showAnswer: boolean;
  onRevealAnswer: () => void;
  onCorrect: () => void;
  onWrong: () => void;
  onClose: () => void;
  disableActions?: boolean;
};

const DEFAULT_STOP_SECONDS = 10;

function normalizeUrl(raw: string): string {
  // Some URLs may come in HTML-escaped (&amp;), so normalize them.
  return raw.replace(/&amp;/g, "&");
}

function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(normalizeUrl(url));
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    }
    if (parsed.searchParams.get("v")) {
      return parsed.searchParams.get("v");
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "embed" && parts[1]) {
      return parts[1];
    }
  } catch (e) {
    return null;
  }
  return null;
}

function parseStartSeconds(url: string | null | undefined): number {
  if (!url) return 0;
  try {
    const parsed = new URL(normalizeUrl(url));
    const startParam = parsed.searchParams.get("start") || parsed.searchParams.get("t");
    if (startParam) {
      const match = startParam.match(/(\d+)/);
      const val = match ? Number(match[1]) : Number(startParam);
      if (Number.isFinite(val)) return Math.max(0, Math.floor(val));
    }
  } catch (e) {
    return 0;
  }
  return 0;
}

function buildEmbedUrl(raw: string | null | undefined, startSeconds = 0) {
  if (!raw) return "";
  const normalized = normalizeUrl(raw);
  const id = extractYouTubeId(raw);
  const base = id ? `https://www.youtube.com/embed/${id}` : normalized;
  const joiner = base.includes("?") ? "&" : "?";
  const startParam = startSeconds > 0 ? `&start=${Math.max(0, Math.floor(startSeconds))}` : "";
  return `${base}${joiner}enablejsapi=1&rel=0&playsinline=1${startParam}`;
}

export function AudioModal({
  question,
  answeringTeamName,
  answeringTeamColor,
  answeringTeamEmoji,
  currentTeamName,
  currentTeamColor,
  currentTeamEmoji,
  showAnswer,
  onRevealAnswer,
  onCorrect,
  onWrong,
  onClose,
  disableActions,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [remaining, setRemaining] = useState<number>(question.audioStopSeconds ?? DEFAULT_STOP_SECONDS);
  const [hiddenSrc, setHiddenSrc] = useState<string>("");
  const [playKey, setPlayKey] = useState<number>(0);

  const stopAfter = useMemo(
    () => Math.max(1, question.audioStopSeconds ?? DEFAULT_STOP_SECONDS),
    [question.audioStopSeconds],
  );
  const startAt = useMemo(
    () => Math.max(0, question.audioStartSeconds ?? parseStartSeconds(question.audioUrl)),
    [question.audioStartSeconds, question.audioUrl],
  );
  const embedUrl = useMemo(() => normalizeUrl(question.audioUrl || ""), [question.audioUrl]);

  const buildPlaySrc = () => {
    const raw = question.audioUrl ? normalizeUrl(question.audioUrl) : "";
    if (!raw) return "";
    const joiner = raw.includes("?") ? "&" : "?";
    return `${raw}${joiner}autoplay=1&playsinline=1&_ts=${Date.now()}`;
  };

  const stopPlayback = (keepRemaining = false) => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setHiddenSrc("");
    setPlayKey((k) => k + 1);
    setIsPlaying(false);
    if (!keepRemaining) {
      setRemaining(0);
    }
  };

  const startPlayback = () => {
    if (!embedUrl) return;
    // Reset timers/state
    stopPlayback(true);
    setRemaining(stopAfter);
    // Force a fresh iframe load with autoplay + start param for reliable seeking
    const src = buildPlaySrc();
    setHiddenSrc(src);
    setPlayKey((k) => k + 1);
    setIsPlaying(true);
    const startedAt = Date.now();

    stopTimerRef.current = setTimeout(() => {
      stopPlayback();
    }, stopAfter * 1000);

    tickRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, stopAfter - elapsed);
      setRemaining(left);
      if (left <= 0.05) {
        stopPlayback();
      }
    }, 150);
  };

  useEffect(() => {
    return () => {
      stopPlayback(true);
    };
  }, []);

  useEffect(() => {
    if (showAnswer) {
      stopPlayback();
      setHiddenSrc("");
      setPlayKey((k) => k + 1);
    }
  }, [showAnswer]);

  useEffect(() => {
    // Reset hidden src when question changes; no autoplay
    stopPlayback(true);
    setHiddenSrc("");
    setIsPlaying(false);
    setRemaining(question.audioStopSeconds ?? DEFAULT_STOP_SECONDS);
  }, [embedUrl, question.audioStopSeconds]);

  return (
    <div
      className="card"
      style={{
        padding: "22px",
        background: "rgba(10, 12, 18, 0.96)",
        borderColor: "rgba(255,255,255,0.18)",
        position: "relative",
        overflow: "visible",
        minHeight: "620px",
        borderRadius: "18px",
      }}
    >
      <div
        className={`flip-inner ${showAnswer ? "flipped" : ""}`}
        style={{
          position: "relative",
          width: "100%",
          minHeight: "580px",
          transformStyle: "preserve-3d",
          transition: "transform 0.5s ease",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            display: "grid",
            gridTemplateRows: "auto 1fr auto",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
              gap: "10px",
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
                {question.category} · Audio
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 800 }}>
                {question.points} pts
              </div>
              {answeringTeamName && (
                <TeamPill
                  label="Answering"
                  name={answeringTeamName}
                  color={answeringTeamColor}
                  emoji={answeringTeamEmoji}
                />
              )}
              {currentTeamName && !answeringTeamName && (
                <TeamPill label="Current" name={currentTeamName} color={currentTeamColor} emoji={currentTeamEmoji} />
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: "10px",
              alignItems: "start",
              alignContent: "start",
              overflow: "hidden",
            }}
          >
            <div style={{ fontSize: "2rem", lineHeight: 1.35, marginBottom: "0px" }}>
              {question.prompt || "No prompt provided."}
            </div>
            <div
              style={{
                position: "relative",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.12)",
                background:
                  "linear-gradient(135deg, rgba(129,230,217,0.06), rgba(69,105,144,0.16))",
                padding: "16px",
                display: "grid",
                alignItems: "stretch",
                justifyItems: "stretch",
                alignSelf: "center",
                minHeight: "220px",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0.6,
                  pointerEvents: "none",
                  background:
                    "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.06), transparent 30%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.08), transparent 32%)",
                }}
              />
              <div
                style={{
                  display: "grid",
                  placeItems: "center",
                  height: "100%",
                  zIndex: 1,
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    width: "100%",
                    maxWidth: "520px",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(24, 1fr)",
                      gap: "6px",
                      alignItems: "end",
                      height: "140px",
                    }}
                  >
                    {new Array(24).fill(0).map((_, idx) => {
                      const phase = (idx % 5) * 60;
                      const active = isPlaying;
                      const height = active
                        ? `${30 + ((idx * 7) % 70)}%`
                        : `${20 + (idx % 6) * 4}%`;
                      return (
                        <span
                          key={idx}
                          style={{
                            display: "block",
                            width: "100%",
                            borderRadius: "6px 6px 2px 2px",
                            background: active ? "#81e6d9" : "rgba(255,255,255,0.28)",
                            height,
                            transition: "height 0.2s ease, background 0.2s ease",
                            animation: active ? `vizPulse 1.2s ease-in-out ${phase}ms infinite` : "none",
                          }}
                        />
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "center", marginTop: "18px" }}>
                    <button
                      className="button secondary"
                      onClick={startPlayback}
                      disabled={!embedUrl || isPlaying}
                      style={{
                        position: "relative",
                        overflow: "hidden",
                        minWidth: "180px",
                        opacity: !embedUrl || isPlaying ? 0.65 : 1,
                        boxShadow: isPlaying
                          ? "0 0 0 0 rgba(129, 230, 217, 0.55)"
                          : "0 10px 26px rgba(0,0,0,0.35)",
                        animation: isPlaying ? "pulse-ring 1.1s ease-in-out infinite" : "none",
                      }}
                    >
                      {isPlaying ? "Playing..." : "Play clip"}
                    </button>
                    <button
                      className="button ghost"
                      onClick={() => stopPlayback()}
                      disabled={!isPlaying}
                      style={{ minWidth: "140px", opacity: !isPlaying ? 0.6 : 1 }}
                    >
                      Stop
                    </button>
                    <div style={{ color: "var(--muted)", fontSize: "0.95rem", display: "grid", gap: "4px", textAlign: "center", minWidth: "160px" }}>
                      {isPlaying ? (
                        <span style={{ color: "#81e6d9", fontWeight: 700 }}>
                          {remaining?.toFixed(1)}s left
                        </span>
                      ) : (
                        <>
                          <span>
                            {startAt > 0
                              ? `Starts at ${startAt}s, plays for ${stopAfter} second(s).`
                              : `Plays for ${stopAfter} second(s).`}
                          </span>
                          {!embedUrl && <span style={{ color: "#f87171" }}>Missing YouTube URL</span>}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
                {embedUrl && (
                  <iframe
                    key={playKey}
                    ref={iframeRef}
                    title="Hidden audio"
                    src={hiddenSrc || embedUrl}
                    allow="autoplay; encrypted-media; picture-in-picture; accelerometer; clipboard-write; gyroscope"
                    style={{
                      border: 0,
                      width: "1px",
                      height: "1px",
                      opacity: 0,
                      pointerEvents: "none",
                      position: "absolute",
                      left: "-9999px",
                      top: "-9999px",
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              marginTop: "12px",
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

        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px",
              background: "rgba(10, 12, 18, 0.96)",
              minHeight: "100%",
              display: "grid",
              gridTemplateRows: "auto auto 1fr auto auto",
              gap: "14px",
              overflow: "hidden",
            }}
          >
            <div>
              <div
                style={{
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  letterSpacing: "0.05em",
                  fontWeight: 800,
                }}
              >
                {question.category} · Audio
              </div>
              <div style={{ fontWeight: 800, fontSize: "2rem", marginTop: "6px" }}>
                {question.points} pts
              </div>
            </div>
            <div style={{ fontSize: "1.2rem", lineHeight: 1.4, fontWeight: 700 }}>
              Answer:{" "}
              <span style={{ fontWeight: 800 }}>
                {question.answer || "No answer provided."}
              </span>
            </div>
            <div
              style={{
                borderRadius: "12px",
                overflow: "hidden",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.12)",
                minHeight: "300px",
                maxHeight: "360px",
                position: "relative",
                isolation: "isolate",
              }}
            >
              {embedUrl ? (
                <iframe
                  title="Answer video"
                  src={embedUrl}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{
                    width: "100%",
                    height: "100%",
                    border: 0,
                    display: "block",
                    position: "relative",
                    zIndex: 2,
                  }}
                />
              ) : (
                <div style={{ padding: "14px", color: "var(--muted)" }}>No video provided.</div>
              )}
            </div>
            {answeringTeamName && (
              <TeamPill
                label="Answered by"
                name={answeringTeamName}
                color={answeringTeamColor}
                emoji={answeringTeamEmoji}
              />
            )}
            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "6px",
                justifyContent: "flex-start",
              }}
            >
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
  );
}
