'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractYouTubeId } from "@/lib/youtube";
import { loadYouTubePlayerApi, type YouTubePlayer } from "@/lib/youtubePlayer";

export type FinaleMusicStatus =
  | "idle"
  | "preparing"
  | "ready"
  | "loading"
  | "playing"
  | "blocked"
  | "ended"
  | "error";

type Options = {
  enabled: boolean;
  url: string;
  startSeconds: number;
  endSeconds: number;
  volume: number;
  prepare: boolean;
};

export function useFinaleSoundtrack({
  enabled,
  url,
  startSeconds,
  endSeconds,
  volume,
  prepare,
}: Options) {
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const playerReadyRef = useRef(false);
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playRequestedRef = useRef(false);
  const playbackOriginRef = useRef<number | null>(null);
  const pendingPlayRef = useRef(false);
  const startRef = useRef(startSeconds);
  const endRef = useRef(endSeconds);
  const volumeRef = useRef(volume);
  const [status, setStatus] = useState<FinaleMusicStatus>("idle");
  const [remaining, setRemaining] = useState(Math.max(0.1, endSeconds - startSeconds));
  const [message, setMessage] = useState("");
  const [activated, setActivated] = useState(false);
  const videoId = useMemo(() => extractYouTubeId(url), [url]);

  useEffect(() => {
    if (prepare) setActivated(true);
  }, [prepare]);

  useEffect(() => {
    startRef.current = Math.max(0, startSeconds);
    endRef.current = Math.max(startRef.current + 0.1, endSeconds);
    volumeRef.current = Math.min(100, Math.max(0, volume));
    setRemaining(Math.max(0.1, endRef.current - startRef.current));
    playerRef.current?.setVolume(volumeRef.current);
  }, [endSeconds, startSeconds, volume]);

  const clearTimers = useCallback(() => {
    if (monitorRef.current) clearInterval(monitorRef.current);
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    monitorRef.current = null;
    watchdogRef.current = null;
  }, []);

  const stop = useCallback((nextStatus: FinaleMusicStatus = "ready") => {
    clearTimers();
    playRequestedRef.current = false;
    pendingPlayRef.current = false;
    playbackOriginRef.current = null;
    playerRef.current?.pauseVideo();
    setStatus(nextStatus);
  }, [clearTimers]);

  const beginPlayback = useCallback((player: YouTubePlayer) => {
    clearTimers();
    setMessage("");
    setRemaining(Math.max(0.1, endRef.current - startRef.current));
    setStatus("loading");
    playRequestedRef.current = true;
    pendingPlayRef.current = false;
    playbackOriginRef.current = null;
    player.setVolume(volumeRef.current);
    player.loadVideoById({
      videoId: videoId ?? "",
      startSeconds: startRef.current,
      endSeconds: endRef.current,
    });
    watchdogRef.current = setTimeout(() => {
      if (!playRequestedRef.current || playbackOriginRef.current != null) return;
      playRequestedRef.current = false;
      playerRef.current?.pauseVideo();
      setStatus("blocked");
      setMessage("Your browser stopped automatic playback. Start the music when you are ready.");
    }, 4500);
  }, [clearTimers, videoId]);

  const requestPlay = useCallback(() => {
    if (!enabled || !videoId) return;
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) {
      pendingPlayRef.current = true;
      setStatus("preparing");
      return;
    }
    beginPlayback(player);
  }, [beginPlayback, enabled, videoId]);

  useEffect(() => {
    if (!enabled || !activated || !videoId || !playerHostRef.current) {
      if (!enabled || !videoId) setStatus("idle");
      return;
    }

    let cancelled = false;
    let player: YouTubePlayer | null = null;
    setStatus((current) => current === "loading" || current === "playing" ? current : "preparing");

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
              playerReadyRef.current = true;
              event.target.setVolume(volumeRef.current);
              event.target.cueVideoById({
                videoId,
                startSeconds: startRef.current,
                endSeconds: endRef.current,
              });
              setStatus("ready");
              if (pendingPlayRef.current) beginPlayback(event.target);
            },
            onStateChange: (event) => {
              if (!playRequestedRef.current) return;
              if (event.data === YT.PlayerState.PLAYING) {
                if (watchdogRef.current) clearTimeout(watchdogRef.current);
                watchdogRef.current = null;
                playbackOriginRef.current ??= event.target.getCurrentTime();
                setStatus("playing");
                if (!monitorRef.current) {
                  monitorRef.current = setInterval(() => {
                    const activePlayer = playerRef.current;
                    if (!activePlayer || playbackOriginRef.current == null || !playRequestedRef.current) return;
                    const left = Math.max(0, endRef.current - activePlayer.getCurrentTime());
                    setRemaining(left);
                    if (left <= 0.05) stop("ended");
                  }, 100);
                }
              } else if (event.data === YT.PlayerState.BUFFERING) {
                setStatus("loading");
              } else if (event.data === YT.PlayerState.ENDED) {
                stop("ended");
              }
            },
            onAutoplayBlocked: () => {
              playRequestedRef.current = false;
              clearTimers();
              setStatus("blocked");
              setMessage("Your browser stopped automatic playback. Start the music when you are ready.");
            },
            onError: () => {
              playRequestedRef.current = false;
              clearTimers();
              setStatus("error");
              setMessage("YouTube could not play the finale soundtrack.");
            },
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        setMessage("Could not prepare the YouTube player.");
      });

    return () => {
      cancelled = true;
      clearTimers();
      player?.destroy();
      playerRef.current = null;
      playerReadyRef.current = false;
      playRequestedRef.current = false;
      playbackOriginRef.current = null;
    };
  }, [activated, beginPlayback, clearTimers, enabled, stop, videoId]);

  return { playerHostRef, status, remaining, message, requestPlay, stop, configured: enabled && Boolean(videoId) };
}
