'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { extractYouTubeId } from "@/lib/youtube";
import { loadYouTubePlayerApi, type YouTubePlayer } from "@/lib/youtubePlayer";

type Props = {
  url: string;
  startSeconds: number;
  endSeconds: number;
};

function formatSeconds(value: number) {
  return `${Math.max(0, value).toFixed(1)}s`;
}

export function YouTubeClipPreview({ url, startSeconds, endSeconds }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentSeconds, setCurrentSeconds] = useState(startSeconds);
  const [error, setError] = useState("");
  const videoId = extractYouTubeId(url);

  const clearMonitor = useCallback(() => {
    if (monitorRef.current) clearInterval(monitorRef.current);
    monitorRef.current = null;
  }, []);

  const stopAtFinish = useCallback(() => {
    clearMonitor();
    playerRef.current?.pauseVideo();
    setPlaying(false);
    setCurrentSeconds(endSeconds);
  }, [clearMonitor, endSeconds]);

  useEffect(() => {
    if (!videoId || !hostRef.current || endSeconds <= startSeconds) return;
    let cancelled = false;
    let player: YouTubePlayer | null = null;

    loadYouTubePlayerApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        player = new YT.Player(hostRef.current, {
          width: 640,
          height: 360,
          videoId,
          playerVars: {
            controls: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              playerRef.current = event.target;
              event.target.cueVideoById({ videoId, startSeconds, endSeconds });
              setCurrentSeconds(startSeconds);
              setReady(true);
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.PLAYING) {
                setPlaying(true);
                clearMonitor();
                monitorRef.current = setInterval(() => {
                  const current = playerRef.current?.getCurrentTime() ?? startSeconds;
                  setCurrentSeconds(current);
                  if (current >= endSeconds - 0.05) stopAtFinish();
                }, 100);
              } else if (event.data === YT.PlayerState.ENDED) {
                stopAtFinish();
              } else if (event.data === YT.PlayerState.PAUSED) {
                clearMonitor();
                setPlaying(false);
                setCurrentSeconds(event.target.getCurrentTime());
              }
            },
            onError: () => {
              clearMonitor();
              setPlaying(false);
              setError("YouTube could not load this preview.");
            },
          },
        });
      })
      .catch(() => setError("Could not prepare the YouTube preview."));

    return () => {
      cancelled = true;
      clearMonitor();
      player?.destroy();
      playerRef.current = null;
    };
  }, [clearMonitor, endSeconds, startSeconds, stopAtFinish, videoId]);

  const playClip = () => {
    if (!playerRef.current || !videoId || !ready) return;
    setError("");
    setCurrentSeconds(startSeconds);
    playerRef.current.loadVideoById({ videoId, startSeconds, endSeconds });
  };

  const remaining = Math.max(0, endSeconds - currentSeconds);

  return (
    <div className="question-finale-clip-preview">
      <div className="question-finale-music-preview">
        <div ref={hostRef} />
      </div>
      <div className="question-finale-preview-controls">
        <button className="button secondary compact" type="button" disabled={!ready} onClick={playClip}>
          {playing ? "Restart clip" : ready ? "Play exact clip" : "Preparing preview…"}
        </button>
        <div className="question-finale-preview-timing" role="status">
          <strong>{formatSeconds(currentSeconds)}</strong>
          <span>Start {formatSeconds(startSeconds)} · Finish {formatSeconds(endSeconds)}</span>
          {playing && <small>{formatSeconds(remaining)} remaining</small>}
        </div>
      </div>
      {error && <small className="question-finale-music-error">{error}</small>}
    </div>
  );
}
