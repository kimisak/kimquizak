'use client';

import { useEffect, useState, type CSSProperties } from "react";
import type { FinaleMusicStatus } from "@/hooks/useFinaleSoundtrack";
import { TeamPill } from "@/components/game/TeamPill";
import type { Team } from "@/lib/types";
import { getTeamAccent, getTeamMarker } from "@/lib/teamPresentation";

type Props = {
  teams: Team[];
  onClose: () => void;
  onReveal: () => void;
  revealed: boolean;
  preview?: boolean;
  music?: {
    configured: boolean;
    status: FinaleMusicStatus;
    remaining: number;
    message: string;
    onStart: () => void;
  };
};

const podiumMedals = ["🥇", "🥈", "🥉"];
const celebrationEmoji = ["✨", "🎊", "⭐", "🥂", "🎉", "❄️", "💫", "🎄"];
const fireworkOrigins = [
  { left: "13%", top: "25%", delay: "0s" },
  { left: "86%", top: "20%", delay: "-.85s" },
  { left: "74%", top: "72%", delay: "-1.55s" },
  { left: "24%", top: "78%", delay: "-2.15s" },
];

export function FinalCelebration({
  teams,
  onClose,
  onReveal,
  revealed,
  preview = false,
  music,
}: Props) {
  const podium = teams.slice(0, 3);
  const winner = podium[0];
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [forceMotion, setForceMotion] = useState(preview);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(media.matches);
    syncPreference();
    media.addEventListener("change", syncPreference);
    return () => media.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!revealed) {
    const soundtrackReady = !music?.configured || ["ready", "blocked", "ended", "error"].includes(music.status);
    return (
      <div
        className="final-score-overlay finale-suspense-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finale-suspense-title"
      >
        <section className="finale-suspense-stage">
          <span className="finale-suspense-kicker">
            {preview ? "Finale preview" : "The board is complete"}
          </span>
          <div className="finale-suspense-mark" aria-hidden>✦</div>
          <h1 id="finale-suspense-title">Final scores are locked.</h1>
          <p>Hold the room. The podium is ready when you are.</p>
          <div className={`finale-suspense-status${soundtrackReady ? " ready" : ""}`} role="status">
            <span aria-hidden>{soundtrackReady ? "✓" : "…"}</span>
            {soundtrackReady
              ? !music?.configured
                ? "The podium will reveal when the drumroll ends"
                : music.status === "error"
                  ? "The podium will reveal without music"
                  : "Soundtrack cued · reveal follows the drumroll"
              : "Preparing finale soundtrack · reveal follows automatically"}
          </div>
          <button
            className="finale-suspense-skip"
            type="button"
            disabled={!soundtrackReady}
            onClick={onReveal}
            autoFocus
          >
            Skip drumroll and reveal now
          </button>
          <button className="finale-suspense-cancel" type="button" onClick={onClose}>
            Back to the board
          </button>
        </section>
      </div>
    );
  }

  return (
    <div
      className={`final-score-overlay finale-overlay${forceMotion ? " motion-enabled" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="finale-title"
    >
      <div className="finale-fireworks" aria-hidden="true">
        <div className="finale-confetti-stream">
          {Array.from({ length: 28 }, (_, index) => (
            <span
              key={index}
              className="finale-confetti-piece"
              style={{
                "--confetti-left": `${3 + ((index * 37) % 94)}%`,
                "--confetti-top": `${4 + ((index * 43) % 88)}%`,
                "--confetti-drift": `${((index % 7) - 3) * 18}px`,
                "--confetti-delay": `${(index % 14) * -0.37}s`,
                "--confetti-duration": `${4.1 + (index % 5) * 0.42}s`,
                "--confetti-rotation": `${(index % 2 ? 1 : -1) * (120 + index * 17)}deg`,
              } as CSSProperties}
            >
              {celebrationEmoji[(index * 3) % celebrationEmoji.length]}
            </span>
          ))}
        </div>
        {fireworkOrigins.map((origin, burstIndex) => (
          <div
            key={`${origin.left}-${origin.top}`}
            className="finale-firework"
            style={{
              left: origin.left,
              top: origin.top,
              "--firework-delay": origin.delay,
            } as CSSProperties}
          >
            {Array.from({ length: 10 }, (_, particleIndex) => {
              const angle = (Math.PI * 2 * particleIndex) / 10;
              const distance = 72 + ((particleIndex + burstIndex) % 3) * 25;
              return (
                <span
                  key={particleIndex}
                  className="finale-firework-particle"
                  style={{
                    "--particle-x": `${Math.round(Math.cos(angle) * distance)}px`,
                    "--particle-y": `${Math.round(Math.sin(angle) * distance)}px`,
                    "--particle-delay": `${particleIndex * 35}ms`,
                  } as CSSProperties}
                >
                  {celebrationEmoji[(particleIndex + burstIndex * 2) % celebrationEmoji.length]}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <section className="finale-stage">
        <header className="finale-header">
          <span className="finale-kicker">
            {preview ? "Finale preview" : "The final scores are in"}
          </span>
          <h1 id="finale-title">That&apos;s a wrap!</h1>
          <p>
            {winner
              ? <>Make some noise for <strong>{winner.name}</strong>!</>
              : "Your final podium will take the stage here."}
          </p>
        </header>

        <section className="finale-podium" aria-label="Final podium">
          {podium.length > 0 ? podium.map((team, index) => {
            const accent = getTeamAccent(team);
            const namedPlayers = team.players.filter((player) => player.name.trim());
            return (
              <article
                key={team.id}
                className={`finale-team finale-team-${index + 1}`}
                style={{
                  "--finale-team-base": accent.base,
                  "--finale-team-accent": accent.onLight,
                  "--finale-team-glow": accent.glow,
                } as CSSProperties}
              >
                <span className="finale-medal" aria-label={`Place ${index + 1}`} role="img">
                  {podiumMedals[index]}
                </span>
                <div className="finale-team-identity">
                  <div
                    className="finale-team-dance"
                    style={{ animationDelay: `${index * -0.27}s` }}
                  >
                    <TeamPill
                      name={team.name}
                      color={accent.base}
                      emoji={getTeamMarker(team)}
                    />
                  </div>
                  {namedPlayers.length > 0 && (
                    <div className="finale-player-list" aria-label={`Players in ${team.name}`}>
                      {namedPlayers.map((player, playerIndex) => (
                        <span
                          key={player.id}
                          style={{ "--player-delay": `${playerIndex * -0.19}s` } as CSSProperties}
                        >
                          {player.name.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <strong className="finale-score">{team.score}<small> pts</small></strong>
              </article>
            );
          }) : (
            <div className="finale-empty">Add teams to preview the full celebration.</div>
          )}
        </section>

        {teams.length > 3 && (
          <div className="finale-everyone">
            <span>And a huge cheer for</span>
            <div>
              {teams.slice(3).map((team) => (
                <span key={team.id} title={team.name}>
                  <span aria-hidden>{getTeamMarker(team)}</span> {team.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="finale-actions">
          {music?.configured && (
            <div className={`finale-music-status ${music.status}`} role="status">
              <span aria-hidden>{music.status === "playing" ? "♫" : "♪"}</span>
              <div>
                <strong>
                  {music.status === "playing"
                    ? `Finale soundtrack · ${music.remaining.toFixed(1)}s`
                    : music.status === "loading" || music.status === "preparing"
                      ? "Preparing finale soundtrack…"
                      : music.status === "ended"
                        ? "Soundtrack finished"
                        : music.status === "error"
                          ? "Soundtrack unavailable"
                          : "Finale soundtrack ready"}
                </strong>
                {music.message && <small>{music.message}</small>}
              </div>
              {["ready", "blocked", "ended", "error", "idle"].includes(music.status) && (
                <button className="button finale-music-start" type="button" onClick={music.onStart}>
                  {music.status === "ended" ? "Replay music" : "▶ Start music"}
                </button>
              )}
            </div>
          )}
          {prefersReducedMotion && (
            <button
              className="button finale-motion-toggle"
              type="button"
              onClick={() => setForceMotion((enabled) => !enabled)}
            >
              {forceMotion ? "Pause animation" : "▶ Start celebration"}
            </button>
          )}
          <button className="button finale-close" type="button" onClick={onClose} autoFocus>
            Back to the board
          </button>
        </div>
      </section>
    </div>
  );
}
