'use client';

import { useEffect, useState, type CSSProperties } from "react";
import type { FinaleMusicStatus } from "@/hooks/useFinaleSoundtrack";
import { TeamPill } from "@/components/game/TeamPill";
import type { Team } from "@/lib/types";
import { getTeamAccent, getTeamMarker } from "@/lib/teamPresentation";

type Props = {
  teams: Team[];
  onClose: () => void;
  onStartDrumroll: () => void;
  onReveal: () => void;
  revealed: boolean;
  drumrollStarted: boolean;
  drumrollSeconds?: number;
  stagedReveal?: boolean;
  revealedPlaceCount?: number;
  onRevealNextPlace?: () => void;
  onRevealCueStart?: () => void;
  onRevealCueStop?: () => void;
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
const playerMoods = ["🥳", "😄", "🤩", "😁", "😆", "☺️"];
const flushReactions = ["😱", "😢", "😬", "🤢", "🤮"];
const playerCheers = ["🍻", "🥂", "🍺", "🎉", "🎊", "🍾", "✨"];
const flushDrift = [-100, -38, 38, 100];
const fireworkOrigins = [
  { left: "13%", top: "25%", delay: "0s" },
  { left: "86%", top: "20%", delay: "-.85s" },
  { left: "74%", top: "72%", delay: "-1.55s" },
  { left: "24%", top: "78%", delay: "-2.15s" },
];

export function FinalCelebration({
  teams,
  onClose,
  onStartDrumroll,
  onReveal,
  revealed,
  drumrollStarted,
  drumrollSeconds = 4,
  stagedReveal = false,
  revealedPlaceCount = 3,
  onRevealNextPlace,
  onRevealCueStart,
  onRevealCueStop,
  preview = false,
  music,
}: Props) {
  const podium = teams.slice(0, 3);
  const winner = podium[0];
  const visiblePlaceCount = stagedReveal
    ? Math.max(0, Math.min(podium.length, revealedPlaceCount))
    : podium.length;
  const celebrationActive = !stagedReveal || visiblePlaceCount >= podium.length;
  const latestRevealedIndex = podium.length - visiblePlaceCount;
  const nextPlaceIndex = latestRevealedIndex - 1;
  const intermediateRevealEmoji = latestRevealedIndex === 0
    ? ["🥇", "🏆", "✨", "🍾", "🥂", "🎉", "👑"]
    : latestRevealedIndex === 1
      ? ["🥈", "✨", "🎉", "🥂", "👏"]
      : ["🥉", "✨", "🎊", "👏", "🌟"];
  const placeLabel = (index: number) => index === 0 ? "1st" : index === 1 ? "2nd" : "3rd";
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [forceMotion, setForceMotion] = useState(true);
  const [cheerBeat, setCheerBeat] = useState(0);
  const [flushVisible, setFlushVisible] = useState(false);
  const [flushBeat, setFlushBeat] = useState(0);
  const [drumrollCountdown, setDrumrollCountdown] = useState(drumrollSeconds);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, []);

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

  useEffect(() => {
    if (!revealed || !celebrationActive || (prefersReducedMotion && !forceMotion)) return;
    const interval = window.setInterval(() => setCheerBeat((beat) => beat + 1), 2600);
    return () => window.clearInterval(interval);
  }, [celebrationActive, revealed, prefersReducedMotion, forceMotion]);

  useEffect(() => {
    if (!drumrollStarted) return;
    const deadline = performance.now() + drumrollSeconds * 1000;
    const updateCountdown = () => {
      const secondsLeft = Math.max(1, Math.ceil((deadline - performance.now()) / 1000));
      setDrumrollCountdown(secondsLeft);
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 50);
    return () => window.clearInterval(interval);
  }, [drumrollSeconds, drumrollStarted]);

  useEffect(() => {
    if (!flushVisible) return;
    const interval = window.setInterval(() => setFlushBeat((beat) => beat + 1), 1000);
    return () => window.clearInterval(interval);
  }, [flushVisible]);

  useEffect(() => {
    if (!revealed || !celebrationActive || teams.length < 4 || (prefersReducedMotion && !forceMotion)) return;
    // A single multi-wave gag; preview brings it forward for testing.
    const delay = preview ? 4000 : 10000;
    let hideTimer: number | undefined;
    const showTimer = window.setTimeout(() => {
      setFlushBeat(0);
      setFlushVisible(true);
      hideTimer = window.setTimeout(() => setFlushVisible(false), 6200);
    }, delay);
    return () => {
      window.clearTimeout(showTimer);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    };
  }, [celebrationActive, revealed, preview, teams.length, prefersReducedMotion, forceMotion]);

  const renderPlayers = (team: Team, teamIndex: number) => {
    const accent = getTeamAccent(team);
    const marker = getTeamMarker(team);
    const namedPlayers = team.players.filter((player) => player.name.trim());
    if (!namedPlayers.length) return null;
    return (
      <div
        className="finale-player-list"
        aria-label={`Players in ${team.name}`}
        style={{ "--team-base": accent.base } as CSSProperties}
      >
        {namedPlayers.map((player, playerIndex) => {
          const isAffected = flushVisible && teamIndex >= 3;
          const mood = isAffected
            ? flushReactions[(flushBeat + playerIndex + (teamIndex - 3) * 2) % flushReactions.length]
            : playerMoods[(cheerBeat + playerIndex + teamIndex * 2) % playerMoods.length];
          const cheer = playerCheers[(playerIndex + teamIndex) % playerCheers.length];
          const secondCheer = playerCheers[(playerIndex + teamIndex + 3) % playerCheers.length];
          return (
            <span
              className={`finale-player-pill${isAffected ? " is-flushed" : ""}`}
              key={player.id}
              style={{ "--player-delay": `${(playerIndex + teamIndex * 2) * -0.31}s` } as CSSProperties}
            >
              <span className="finale-player-marker" aria-hidden>{marker}</span>
              <span className="finale-player-name">{player.name.trim()}</span>
              <span className="finale-player-mood" aria-hidden>{mood}</span>
              <span className="finale-player-cheer" aria-hidden>{cheer}</span>
              <span className="finale-player-cheer is-second" aria-hidden>{secondCheer}</span>
            </span>
          );
        })}
      </div>
    );
  };

  if (!revealed) {
    const soundtrackReady = !music?.configured || ["ready", "blocked", "ended", "error"].includes(music.status);
    return (
      <div
        className="final-score-overlay finale-suspense-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finale-suspense-title"
      >
        <section className={`finale-suspense-stage${drumrollStarted ? " is-counting" : ""}`}>
          {drumrollStarted ? (
            <>
              <h1 className="finale-countdown-heading" id="finale-suspense-title">Final scores locked</h1>
            <div
              className="finale-suspense-countdown"
              role="timer"
              aria-live="assertive"
              aria-atomic="true"
              style={{ "--countdown-progress": `${((drumrollSeconds - drumrollCountdown) / drumrollSeconds) * 100}%` } as CSSProperties}
            >
              <div className="finale-countdown-number">
                <i aria-hidden />
                <span key={drumrollCountdown}>{drumrollCountdown}</span>
                <i aria-hidden />
              </div>
              <div className="finale-countdown-track" aria-hidden><span /></div>
              <div className="finale-countdown-beats" aria-hidden>
                {Array.from({ length: drumrollSeconds }, (_, index) => (
                  <i className={index < drumrollSeconds - drumrollCountdown ? "elapsed" : ""} key={index} />
                ))}
              </div>
            </div>
              <button className="finale-suspense-skip" type="button" onClick={onReveal}>
                Reveal now
              </button>
            </>
          ) : (
            <>
              <span className="finale-suspense-kicker">
                {preview ? "Finale preview" : "The board is complete"}
              </span>
              <div className="finale-suspense-mark" aria-hidden>✦</div>
              <h1 id="finale-suspense-title">Final scores are locked.</h1>
              <p>Hold the room. Start the reveal when everyone is ready.</p>
              <div className={`finale-suspense-status${soundtrackReady ? " ready" : ""}`} role="status">
                <span aria-hidden>{soundtrackReady ? "✓" : "…"}</span>
                {soundtrackReady
                  ? !music?.configured
                    ? "Podium ready · waiting for the host"
                    : music.status === "error"
                      ? "Podium ready · soundtrack unavailable"
                      : "Soundtrack cued · waiting for the host"
                  : "Preparing finale soundtrack · you can start when the room is ready"}
              </div>
              <button
                className="button primary finale-suspense-start"
                type="button"
                onClick={stagedReveal ? onReveal : onStartDrumroll}
                autoFocus
              >
                {stagedReveal ? "Continue to the podium" : <><span aria-hidden>🥁</span> Start drum roll</>}
              </button>
              <button className="finale-suspense-cancel" type="button" onClick={onClose}>
                Back to the board
              </button>
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <div
      className={`final-score-overlay finale-overlay${celebrationActive ? " celebration-active" : " is-staged"}${forceMotion ? " motion-enabled" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="finale-title"
    >
      {celebrationActive && <div className="finale-fireworks" aria-hidden="true">
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
      </div>}

      <section className="finale-stage">
        <header className="finale-header">
          <span className="finale-kicker">
            {celebrationActive ? preview ? "Finale preview" : "The final scores are in" : "One place at a time"}
          </span>
          <h1 id="finale-title">{celebrationActive ? "That's a wrap!" : "Final podium"}</h1>
          <p>
            {celebrationActive && winner
              ? <>Make some noise for <strong>{winner.name}</strong>!</>
              : celebrationActive ? "Your final podium will take the stage here." : "The host controls every reveal."}
          </p>
        </header>

        <section className="finale-podium" aria-label="Final podium">
          {podium.length > 0 ? podium.map((team, index) => {
            const accent = getTeamAccent(team);
            const isPlaceVisible = index >= latestRevealedIndex;
            const isLatestReveal = isPlaceVisible && index === latestRevealedIndex;
            return (
              <article
                key={team.id}
                className={`finale-team finale-team-${index + 1}${isPlaceVisible ? " is-place-visible" : " is-place-concealed"}${isLatestReveal ? " is-latest-reveal" : ""}${index === 2 && flushVisible ? " is-flushing" : ""}`}
                style={{
                  "--finale-team-base": accent.base,
                  "--finale-team-accent": accent.onLight,
                  "--finale-team-glow": accent.glow,
                } as CSSProperties}
              >
                <div className="finale-team-content" aria-hidden={!isPlaceVisible}>
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
                      {renderPlayers(team, index)}
                    </div>
                    <strong className="finale-score">{team.score}<small> pts</small></strong>
                </div>
                {!isPlaceVisible && (
                  <div className="finale-place-concealed" aria-label={`${placeLabel(index)} place is hidden`}>
                    <span className="finale-skeleton-medal" aria-hidden>✦</span>
                    <div className="finale-skeleton-identity" aria-hidden>
                      <span className="finale-skeleton-team">
                        <i />
                        <strong>{placeLabel(index)} place</strong>
                      </span>
                      {team.players.some((player) => player.name.trim()) && (
                        <span className="finale-skeleton-players">
                          {team.players.filter((player) => player.name.trim()).map((player) => (
                            <i key={player.id} />
                          ))}
                        </span>
                      )}
                    </div>
                    <span className="finale-skeleton-score" aria-hidden />
                  </div>
                )}
                {stagedReveal && isLatestReveal && (
                  <div
                    className={`finale-intermediate-effects finale-intermediate-place-${index + 1}`}
                    key={`intermediate-reveal-${visiblePlaceCount}`}
                    aria-hidden="true"
                  >
                    <div className="finale-intermediate-flash" />
                    <div className="finale-intermediate-firework">
                      <span className="finale-intermediate-core">{intermediateRevealEmoji[0]}</span>
                      {Array.from({ length: 16 }, (_, particleIndex) => {
                        const angle = (Math.PI * 2 * particleIndex) / 16;
                        const distance = 118 + (particleIndex % 4) * 24;
                        return (
                          <span
                            className="finale-intermediate-particle"
                            key={particleIndex}
                            style={{
                              "--intermediate-x": `${Math.round(Math.cos(angle) * distance)}px`,
                              "--intermediate-y": `${Math.round(Math.sin(angle) * distance)}px`,
                              "--intermediate-delay": `${particleIndex * 22}ms`,
                            } as CSSProperties}
                          >
                            {intermediateRevealEmoji[particleIndex % intermediateRevealEmoji.length]}
                          </span>
                        );
                      })}
                    </div>
                    <div className="finale-intermediate-ooze">
                      {Array.from({ length: 18 }, (_, oozeIndex) => (
                        <span
                          key={oozeIndex}
                          style={{
                            "--intermediate-ooze-left": `${14 + ((oozeIndex * 43) % 72)}%`,
                            "--intermediate-ooze-drift": `${((oozeIndex % 7) - 3) * 19}px`,
                            "--intermediate-ooze-delay": `${240 + (oozeIndex % 9) * 85}ms`,
                          } as CSSProperties}
                        >
                          {intermediateRevealEmoji[(oozeIndex + 1) % intermediateRevealEmoji.length]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {isPlaceVisible && index === 2 && flushVisible && teams.length > 3 && (
                  <div className="finale-flush" aria-hidden="true">
                    <span className="finale-flush-source">🚽</span>
                    <span className="finale-flush-swirl">🌀</span>
                    {Array.from({ length: 3 }, (_, wave) => flushDrift.map((drift, pieceIndex) => (
                      <span
                        className="finale-flush-piece"
                        key={`${wave}-${pieceIndex}`}
                        style={{
                          "--flush-drift": `${drift}px`,
                          "--flush-mid": `${Math.round(drift * 0.18)}px`,
                          "--flush-end": `${Math.round(drift * 1.2)}px`,
                          "--flush-delay": `${wave * 1.25 + pieceIndex * 0.14}s`,
                        } as CSSProperties}
                      >💩</span>
                    )))}
                  </div>
                )}
              </article>
            );
          }) : (
            <div className="finale-empty">Add teams to preview the full celebration.</div>
          )}
        </section>

        {stagedReveal && !celebrationActive && nextPlaceIndex >= 0 && (
          <button
            className="button primary finale-place-reveal"
            type="button"
            onClick={onRevealNextPlace}
            onMouseEnter={onRevealCueStart}
            onMouseLeave={onRevealCueStop}
            onFocus={onRevealCueStart}
            onBlur={onRevealCueStop}
          >
            Reveal {placeLabel(nextPlaceIndex)} place
          </button>
        )}

        {celebrationActive && teams.length > 3 && (
          <div className="finale-everyone">
            <span>And a huge cheer for</span>
            <div>
              {teams.slice(3).map((team, index) => (
                <div className="finale-encore-team" key={team.id}>
                  <span className="finale-encore-name"><span aria-hidden>{getTeamMarker(team)}</span> {team.name}</span>
                  {renderPlayers(team, index + 3)}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="finale-actions">
          {celebrationActive && music?.configured && (
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
          {celebrationActive && prefersReducedMotion && (
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
