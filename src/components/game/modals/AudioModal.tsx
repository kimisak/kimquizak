'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Question } from "@/lib/types";
import { TeamPill } from "@/components/game/TeamPill";
import { buildYouTubeEmbedUrl, extractYouTubeId, getYouTubeStartSeconds } from "@/lib/youtube";
import {
  loadYouTubePlayerApi,
  type YouTubePlayer,
} from "@/lib/youtubePlayer";

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
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playRequestedRef = useRef(false);
  const playbackOriginRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [hasPlayed, setHasPlayed] = useState(false);
  const [remaining, setRemaining] = useState<number>(question.audioStopSeconds ?? DEFAULT_STOP_SECONDS);

  const stopAfter = useMemo(
    () => Math.max(1, question.audioStopSeconds ?? DEFAULT_STOP_SECONDS),
    [question.audioStopSeconds],
  );
  const startAt = useMemo(
    () => Math.max(0, question.audioStartSeconds ?? getYouTubeStartSeconds(question.audioUrl)),
    [question.audioStartSeconds, question.audioUrl],
  );
  const embedUrl = useMemo(
    () => buildYouTubeEmbedUrl(question.audioUrl, { startSeconds: startAt }),
    [question.audioUrl, startAt],
  );
  const videoId = useMemo(() => extractYouTubeId(question.audioUrl), [question.audioUrl]);
  const startAtRef = useRef(startAt);
  const stopAfterRef = useRef(stopAfter);

  useEffect(() => {
    startAtRef.current = startAt;
    stopAfterRef.current = stopAfter;
  }, [startAt, stopAfter]);

  const clearPlaybackMonitor = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const stopPlayback = useCallback((keepRemaining = false) => {
    playRequestedRef.current = false;
    clearPlaybackMonitor();
    playerRef.current?.pauseVideo();
    setIsPlaying(false);
    setIsLoading(false);
    if (!keepRemaining) {
      setRemaining(0);
    }
  }, [clearPlaybackMonitor]);

  const startPlaybackMonitor = useCallback(() => {
    clearPlaybackMonitor();
    tickRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player || !playRequestedRef.current) return;
      const origin = playbackOriginRef.current;
      if (origin == null) return;
      const played = Math.max(0, player.getCurrentTime() - origin);
      const left = Math.max(0, stopAfterRef.current - played);
      setRemaining(left);
      if (left <= 0.05) stopPlayback();
    }, 100);
  }, [clearPlaybackMonitor, stopPlayback]);

  const startPlayback = () => {
    if (!videoId || !playerRef.current || !playerReady || hasPlayed) return;
    stopPlayback(true);
    setRemaining(stopAfter);
    setPlayerError("");
    setIsLoading(true);
    setHasPlayed(true);
    playRequestedRef.current = true;
    playbackOriginRef.current = null;
    playerRef.current.loadVideoById({ videoId, startSeconds: startAt });
  };

  useEffect(() => {
    if (!videoId || !playerHostRef.current) return;
    let cancelled = false;
    let player: YouTubePlayer | null = null;

    loadYouTubePlayerApi()
      .then((YT) => {
        if (cancelled || !playerHostRef.current) return;
        player = new YT.Player(playerHostRef.current, {
          width: 200,
          height: 200,
          videoId,
          playerVars: {
            controls: 0,
            disablekb: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              playerRef.current = event.target;
              event.target.cueVideoById({ videoId, startSeconds: startAtRef.current });
              setPlayerReady(true);
            },
            onStateChange: (event) => {
              if (!playRequestedRef.current) return;
              if (event.data === YT.PlayerState.PLAYING) {
                if (playbackOriginRef.current == null) {
                  playbackOriginRef.current = event.target.getCurrentTime();
                }
                setIsLoading(false);
                setIsPlaying(true);
                startPlaybackMonitor();
              } else if (event.data === YT.PlayerState.BUFFERING) {
                setIsLoading(true);
                setIsPlaying(false);
              } else if (event.data === YT.PlayerState.ENDED) {
                stopPlayback();
              }
            },
            onError: () => {
              playRequestedRef.current = false;
              clearPlaybackMonitor();
              setIsPlaying(false);
              setIsLoading(false);
              setPlayerError("YouTube could not play this clip.");
            },
          },
        });
        playerRef.current = player;
      })
      .catch(() => {
        if (!cancelled) setPlayerError("Could not prepare the YouTube player.");
      });

    return () => {
      cancelled = true;
      playRequestedRef.current = false;
      clearPlaybackMonitor();
      player?.destroy();
      playerRef.current = null;
    };
  }, [videoId, clearPlaybackMonitor, startPlaybackMonitor, stopPlayback]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (showAnswer) {
        stopPlayback();
      }
    }, 0);
    return () => clearTimeout(id);
  }, [showAnswer, stopPlayback]);

  useEffect(() => {
    const id = setTimeout(() => {
      stopPlayback(true);
      setIsPlaying(false);
      setHasPlayed(false);
      setRemaining(question.audioStopSeconds ?? DEFAULT_STOP_SECONDS);
    }, 0);
    return () => clearTimeout(id);
  }, [embedUrl, question.audioStopSeconds, stopPlayback]);

  return (
    <div
      className="card round-stage round-audio"
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
            pointerEvents: showAnswer ? "none" : "auto",
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
              {answeringTeamName && !showAnswer && (
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
                      disabled={!embedUrl || !playerReady || isLoading || isPlaying || hasPlayed}
                      style={{
                        position: "relative",
                        overflow: "hidden",
                        minWidth: "180px",
                        opacity: !embedUrl || !playerReady || isLoading || isPlaying || hasPlayed ? 0.65 : 1,
                        boxShadow: isPlaying
                          ? "0 0 0 0 rgba(129, 230, 217, 0.55)"
                          : "0 10px 26px rgba(0,0,0,0.35)",
                        animation: isPlaying ? "pulse-ring 1.1s ease-in-out infinite" : "none",
                      }}
                    >
                      {!playerReady
                        ? "Preparing player…"
                        : isLoading
                          ? "Loading clip…"
                          : isPlaying
                            ? "Playing…"
                            : hasPlayed
                              ? "Clip played"
                              : "Play clip"}
                    </button>
                    <button
                      className="button ghost"
                      onClick={() => stopPlayback()}
                      disabled={!isPlaying && !isLoading}
                      style={{ minWidth: "140px", opacity: !isPlaying && !isLoading ? 0.6 : 1 }}
                    >
                      Stop
                    </button>
                    <div style={{ color: "var(--muted)", fontSize: "0.95rem", display: "grid", gap: "4px", textAlign: "center", minWidth: "160px" }}>
                      {isPlaying ? (
                        <span style={{ color: "#81e6d9", fontWeight: 700 }}>
                          {remaining?.toFixed(1)}s left
                        </span>
                      ) : isLoading ? (
                        <span style={{ color: "#f7c948", fontWeight: 700 }}>
                          Waiting for YouTube — timer has not started
                        </span>
                      ) : (
                        <>
                          <span>
                            {startAt > 0
                              ? `Starts at ${startAt}s, plays for ${stopAfter} second(s).`
                              : `Plays for ${stopAfter} second(s).`}
                          </span>
                          {!embedUrl && <span style={{ color: "#f87171" }}>Missing YouTube URL</span>}
                          {playerError && <span style={{ color: "#f87171" }}>{playerError}</span>}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div
                aria-hidden
                style={{
                  position: "fixed",
                  width: "200px",
                  height: "200px",
                  left: "-10000px",
                  top: "-10000px",
                  opacity: 0,
                  pointerEvents: "none",
                }}
              >
                <div ref={playerHostRef} />
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
