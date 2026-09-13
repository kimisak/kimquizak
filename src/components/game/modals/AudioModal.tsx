'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Question } from "@/lib/types";
import { QuestionModalActions } from "./QuestionModalActions";
import { QuestionModalHeader } from "./QuestionModalHeader";
import { buildYouTubeEmbedUrl, extractYouTubeId, getYouTubeStartSeconds } from "@/lib/youtube";
import { loadYouTubePlayerApi, type YouTubePlayer } from "@/lib/youtubePlayer";

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
  disableActions?: boolean;
};

const DEFAULT_STOP_SECONDS = 10;

function getTextDensity(value?: string | null) {
  const length = (value || "").trim().length;
  if (length > 280) return "text-density-xlong";
  if (length > 175) return "text-density-long";
  if (length > 95) return "text-density-medium";
  return "text-density-short";
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
    if (!keepRemaining) setRemaining(0);
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
                if (playbackOriginRef.current == null) playbackOriginRef.current = event.target.getCurrentTime();
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
      if (showAnswer) stopPlayback();
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

  const teamName = answeringTeamName || currentTeamName;
  const teamColor = answeringTeamName ? answeringTeamColor : currentTeamColor;
  const teamEmoji = answeringTeamName ? answeringTeamEmoji : currentTeamEmoji;
  const playDisabled = !embedUrl || !playerReady || isLoading || isPlaying || hasPlayed;
  const progress = Math.max(0, Math.min(1, remaining / stopAfter));
  const playerState = playerError
    ? "error"
    : isPlaying
      ? "playing"
      : isLoading
        ? "loading"
        : hasPlayed
          ? "complete"
          : playerReady
            ? "ready"
            : "preparing";
  const statusCopy = playerError
    || (!embedUrl ? "No YouTube clip configured" : null)
    || (isPlaying ? `${remaining.toFixed(1)} seconds remaining` : null)
    || (isLoading ? "YouTube connected · timer waits for the first sound" : null)
    || (hasPlayed ? "Clip complete · reveal when the team has answered" : null)
    || (playerReady ? "Clip loaded and ready" : "Preparing the clip in the background");

  return (
    <article className={`card round-stage round-audio question-modal-card audio-question-modal state-${playerState}${showAnswer ? " answer-visible" : ""}`}>
      <QuestionModalHeader
        category={question.category}
        typeLabel="Guess the audio"
        points={question.points}
        teamName={teamName}
        teamColor={teamColor}
        teamEmoji={teamEmoji}
        teamLabel={showAnswer ? "Answered by" : answeringTeamName ? "Answering" : "Current team"}
      />

      <div className="question-modal-scroll audio-modal-scroll">
        {!showAnswer ? (
          <section className="audio-question-stage">
            <div className={`audio-question-copy ${getTextDensity(question.prompt)}`}>
              <span className="question-modal-eyebrow">Listen closely</span>
              <h1 className={getTextDensity(question.prompt)}>{question.prompt || "What are you listening to?"}</h1>
              <p>The clip can be played once. Its timer begins only when YouTube starts producing audio.</p>
            </div>

            <div className="audio-console">
              <div className="audio-console-status">
                <span className="audio-status-light" aria-hidden />
                <strong>{playerState}</strong>
                <small>{startAt > 0 ? `From ${startAt}s` : "From the beginning"} · {stopAfter}s clip</small>
              </div>

              <div className="audio-waveform" aria-hidden>
                {new Array(32).fill(0).map((_, index) => (
                  <span
                    key={index}
                    style={{
                      "--audio-bar": `${24 + ((index * 17) % 70)}%`,
                      "--audio-delay": `${(index % 8) * -90}ms`,
                    } as CSSProperties}
                  />
                ))}
              </div>

              <div className="audio-play-cluster">
                <button
                  className="audio-play-control"
                  type="button"
                  onClick={startPlayback}
                  disabled={playDisabled}
                  aria-label={isPlaying ? "Audio is playing" : hasPlayed ? "Audio clip has been played" : "Play audio clip"}
                  style={{ "--audio-progress": `${progress * 360}deg` } as CSSProperties}
                >
                  <span className="audio-play-control-core" aria-hidden>
                    {isLoading ? "···" : isPlaying ? "♫" : hasPlayed ? "✓" : "▶"}
                  </span>
                </button>
                <strong>{isLoading ? "Connecting" : isPlaying ? "Now playing" : hasPlayed ? "Played once" : "Play clip"}</strong>
                <small>{statusCopy}</small>
              </div>

              <div className="audio-console-footer">
                <span>{isPlaying ? `${remaining.toFixed(1)} / ${stopAfter.toFixed(1)} sec` : "One controlled playback"}</span>
                <button className="audio-stop-control" type="button" onClick={() => stopPlayback()} disabled={!isPlaying && !isLoading}>
                  ■ Stop
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="audio-answer-stage">
            <div className={`audio-answer-copy ${getTextDensity(`${question.answer ?? ""} ${question.prompt ?? ""}`)}`}>
              <span className="question-modal-eyebrow">Answer</span>
              <h1 className={getTextDensity(question.answer)}>{question.answer || "No answer provided."}</h1>
              {question.prompt && <p className={getTextDensity(question.prompt)}><span>Original prompt</span>{question.prompt}</p>}
            </div>
            <div className="audio-answer-video">
              {embedUrl ? (
                <iframe
                  title="Answer video"
                  src={embedUrl}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div>No video provided.</div>
              )}
            </div>
          </section>
        )}

        <div className="audio-player-host" aria-hidden>
          <div ref={playerHostRef} />
        </div>
      </div>

      <QuestionModalActions
        revealed={showAnswer}
        onReveal={onRevealAnswer}
        onCorrect={onCorrect}
        onWrong={onWrong}
        disabled={disableActions}
      />
    </article>
  );
}
