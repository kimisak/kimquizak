'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import type { Question } from "@/lib/types";
import { QuestionModalActions } from "./QuestionModalActions";
import { QuestionModalHeader } from "./QuestionModalHeader";
import { buildYouTubeEmbedUrl, extractYouTubeId, getYouTubeStartSeconds } from "@/lib/youtube";
import { loadYouTubePlayerApi, type YouTubePlayer } from "@/lib/youtubePlayer";

type Props = {
  question: Question;
  lyricsRevealed: boolean[];
  isRed: (idx: number) => boolean;
  onRevealLine: (idx: number) => void;
  onRevealAll: () => void;
  allRevealed: boolean;
  onRevealAnswer: () => void;
  showAnswer: boolean;
  currentTeamName?: string;
  currentTeamColor?: string;
  currentTeamEmoji?: string | null;
  answeringTeamName?: string;
  answeringTeamColor?: string;
  answeringTeamEmoji?: string | null;
  answerVideoUrl?: string | null;
  answerVideoAutoplay?: boolean;
  onCorrect: () => void;
  onWrong: () => void;
  disableActions?: boolean;
  onNextTeam?: () => void;
};

function getAnswerDensity(value?: string | null) {
  const length = (value || "").trim().length;
  if (length > 220) return "text-density-xlong";
  if (length > 120) return "text-density-long";
  if (length > 65) return "text-density-medium";
  return "text-density-short";
}

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
  currentTeamColor,
  currentTeamEmoji,
  answeringTeamName,
  answeringTeamColor,
  answeringTeamEmoji,
  answerVideoUrl,
  answerVideoAutoplay = true,
  onCorrect,
  onWrong,
  disableActions,
  onNextTeam,
}: Props) {
  const answerPlayerHostRef = useRef<HTMLDivElement | null>(null);
  const answerPlayerRef = useRef<YouTubePlayer | null>(null);
  const [answerVideoState, setAnswerVideoState] = useState<"idle" | "loading" | "ready" | "playing" | "error">("idle");
  const [answerVideoStarted, setAnswerVideoStarted] = useState(false);
  const [revealWithoutVideo, setRevealWithoutVideo] = useState(false);
  const segments = question.lyricsSegments ?? [];
  const revealedCount = segments.reduce((count, _, index) => count + (lyricsRevealed[index] ? 1 : 0), 0);
  const passCount = segments.reduce(
    (count, _, index) => count + (lyricsRevealed[index] && isRed(index) ? 1 : 0),
    0,
  );
  const teamName = answeringTeamName || currentTeamName;
  const teamColor = answeringTeamName ? answeringTeamColor : currentTeamColor;
  const teamEmoji = answeringTeamName ? answeringTeamEmoji : currentTeamEmoji;
  const answerVideoId = useMemo(() => extractYouTubeId(answerVideoUrl), [answerVideoUrl]);
  const answerVideoStart = useMemo(() => getYouTubeStartSeconds(answerVideoUrl), [answerVideoUrl]);
  const answerVideoEmbedUrl = useMemo(
    () => buildYouTubeEmbedUrl(answerVideoUrl, { startSeconds: answerVideoStart }),
    [answerVideoStart, answerVideoUrl],
  );
  const synchronizedReveal = Boolean(answerVideoId && answerVideoAutoplay);
  const answerCanShow = !synchronizedReveal || answerVideoStarted || revealWithoutVideo;

  useEffect(() => {
    if (!showAnswer || !synchronizedReveal || !answerVideoId || !answerPlayerHostRef.current) return;
    let cancelled = false;
    let playbackStarted = false;
    let autoplayFallbackTimer: number | null = null;
    let player: YouTubePlayer | null = null;
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) {
        setAnswerVideoState("loading");
        setAnswerVideoStarted(false);
        setRevealWithoutVideo(false);
      }
    }, 0);

    loadYouTubePlayerApi()
      .then((YT) => {
        if (cancelled || !answerPlayerHostRef.current) return;
        player = new YT.Player(answerPlayerHostRef.current, {
          width: 640,
          height: 360,
          videoId: answerVideoId,
          playerVars: {
            controls: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              answerPlayerRef.current = event.target;
              setAnswerVideoState("loading");
              event.target.loadVideoById({ videoId: answerVideoId, startSeconds: answerVideoStart });
              autoplayFallbackTimer = window.setTimeout(() => {
                if (!cancelled && !playbackStarted) setAnswerVideoState("ready");
              }, 2500);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              if (event.data === YT.PlayerState.PLAYING) {
                playbackStarted = true;
                if (autoplayFallbackTimer != null) window.clearTimeout(autoplayFallbackTimer);
                setAnswerVideoState("playing");
                setAnswerVideoStarted(true);
              }
              if (event.data === YT.PlayerState.BUFFERING) setAnswerVideoState("loading");
            },
            onAutoplayBlocked: () => {
              if (!cancelled) setAnswerVideoState("ready");
            },
            onError: () => {
              if (!cancelled) setAnswerVideoState("error");
            },
          },
        });
        answerPlayerRef.current = player;
      })
      .catch(() => {
        if (!cancelled) setAnswerVideoState("error");
      });

    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
      if (autoplayFallbackTimer != null) window.clearTimeout(autoplayFallbackTimer);
      player?.destroy();
      answerPlayerRef.current = null;
    };
  }, [answerVideoId, answerVideoStart, showAnswer, synchronizedReveal]);

  return (
    <article className={`card round-stage round-lyrics question-modal-card text-grid-modal${showAnswer ? " answer-visible" : ""}`}>
      <QuestionModalHeader
        category={question.category}
        typeLabel="Text grid"
        points={question.points}
        teamName={teamName}
        teamColor={teamColor}
        teamEmoji={teamEmoji}
        teamLabel={showAnswer ? "Answered by" : answeringTeamName ? "Answering" : "Current team"}
      />

      <div className="question-modal-scroll text-grid-scroll">
        {!showAnswer ? (
          <section className="text-grid-stage">
            <header className="text-grid-intro">
              <div>
                <span className="question-modal-eyebrow">Reveal board</span>
                <h1>{question.prompt || "Open tiles to reveal the hidden text."}</h1>
              </div>
              <div className="text-grid-progress" aria-label={`${revealedCount} of ${segments.length} tiles revealed`}>
                <strong>{revealedCount}<span>/{segments.length}</span></strong>
                <small>revealed</small>
              </div>
            </header>

            <div className="text-grid-rule">
              <span aria-hidden>✦</span>
              <p><strong>Choose a tile.</strong> A cranberry pass tile moves play to the next team without changing the score.</p>
              {passCount > 0 && <small>{passCount} pass {passCount === 1 ? "tile" : "tiles"} found</small>}
            </div>

            {segments.length > 0 ? (
              <div className="text-grid-board">
                {segments.map((line, index) => {
                  const revealed = lyricsRevealed[index];
                  const red = isRed(index);
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => onRevealLine(index)}
                      className={`text-grid-tile ${revealed ? red ? "is-pass" : "is-revealed" : "is-concealed"}`}
                      disabled={revealed}
                      aria-label={revealed ? `${red ? "Pass tile" : "Revealed tile"}: ${line || "blank"}` : `Reveal tile ${index + 1}`}
                    >
                      <span className="text-grid-tile-number">{String(index + 1).padStart(2, "0")}</span>
                      {revealed ? (
                        <strong>{line || "(blank)"}</strong>
                      ) : (
                        <span className="text-grid-tile-seal" aria-hidden>✦</span>
                      )}
                      {revealed && red && <small>Pass</small>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-grid-empty">No text-grid lines have been configured.</div>
            )}
          </section>
        ) : (
          <section className={`text-grid-answer-stage${answerVideoEmbedUrl ? " has-video" : ""}${answerCanShow ? " reveal-ready" : " reveal-waiting"}`}>
            {answerCanShow ? (
              <div className="text-grid-answer-copy">
                <span className="question-modal-eyebrow">Answer</span>
                <h1 className={getAnswerDensity(question.answer)}>{question.answer || "No answer provided."}</h1>
                {question.prompt && (
                  <p><span>Original prompt</span>{question.prompt}</p>
                )}
              </div>
            ) : (
              <div className="text-grid-video-curtain" role="status" aria-live="polite">
                <span className="text-grid-video-loader" aria-hidden>♪</span>
                <small>Answer held backstage</small>
                <h2>{answerVideoState === "error" ? "The video could not start" : answerVideoState === "ready" ? "Video ready" : "Preparing the reveal"}</h2>
                <p>{answerVideoState === "ready" ? "Your browser needs one more click before playback can begin." : answerVideoState === "error" ? "You can continue without the video and reveal the answer manually." : "The answer will appear as soon as YouTube starts playing."}</p>
                {answerVideoState === "ready" && (
                  <button className="button text-grid-start-video" type="button" onClick={() => answerPlayerRef.current?.playVideo()}>
                    Start video & reveal
                  </button>
                )}
                {answerVideoState === "error" && (
                  <button className="button text-grid-start-video" type="button" onClick={() => setRevealWithoutVideo(true)}>
                    Reveal without video
                  </button>
                )}
              </div>
            )}
            {answerVideoEmbedUrl && (
              <div className="text-grid-answer-video">
                {synchronizedReveal ? (
                  <div className="text-grid-youtube-player" ref={answerPlayerHostRef} />
                ) : (
                  <iframe
                    title="Text grid answer video"
                    src={answerVideoEmbedUrl}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>
            )}
            {answerCanShow && segments.length > 0 && (
              <div className="text-grid-transcript">
                <span>Complete grid</span>
                <div>
                  {segments.map((line, index) => <strong key={index}>{line || "(blank)"}</strong>)}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      <QuestionModalActions
        revealed={showAnswer}
        onReveal={onRevealAnswer}
        onCorrect={onCorrect}
        onWrong={onWrong}
        disabled={disableActions || (showAnswer && !answerCanShow)}
        before={!showAnswer ? (
          <>
            <button className="button text-grid-reveal-all" type="button" onClick={onRevealAll} disabled={allRevealed}>
              Reveal all tiles
            </button>
            {onNextTeam && (
              <button className="button text-grid-next-team" type="button" onClick={onNextTeam} disabled={disableActions}>
                Next team
              </button>
            )}
          </>
        ) : null}
      />
    </article>
  );
}
