'use client';

import { useEffect, useState, type CSSProperties } from "react";
import type { FinaleMusicStatus } from "@/hooks/useFinaleSoundtrack";
import { TeamPill } from "@/components/game/TeamPill";
import type { Team } from "@/lib/types";
import { getTeamAccent, getTeamMarker } from "@/lib/teamPresentation";
import { getFinaleRevealPlan, ordinalPlace } from "@/lib/finaleReveal";

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
  revealedPlaceCount = Number.MAX_SAFE_INTEGER,
  onRevealNextPlace,
  onRevealCueStart,
  onRevealCueStop,
  preview = false,
  music,
}: Props) {
  const podium = teams.slice(0, 3);
  const winner = podium[0];
  const { tiers, steps } = getFinaleRevealPlan(teams);
  const visiblePlaceCount = stagedReveal ? Math.max(0, Math.min(steps.length, revealedPlaceCount)) : steps.length;
  const celebrationActive = !stagedReveal || visiblePlaceCount >= steps.length;
  const visibleIds = new Set(steps.slice(0, visiblePlaceCount).flatMap(step => step.teamIds));
  const latestIds = new Set(steps[visiblePlaceCount - 1]?.teamIds ?? []);
  const nextStep = steps[visiblePlaceCount];
  const rankOf = (team: Team) => tiers.find(tier => tier.teamIds.includes(team.id))?.rank ?? 1;
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [forceMotion, setForceMotion] = useState(true);
  const [cheerBeat, setCheerBeat] = useState(0);
  const [flushVisible, setFlushVisible] = useState(false);
  const [hasBeenFlushed, setHasBeenFlushed] = useState(false);
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
    if (!hasBeenFlushed || (prefersReducedMotion && !forceMotion)) return;
    const interval = window.setInterval(() => setFlushBeat((beat) => beat + 1), 1000);
    return () => window.clearInterval(interval);
  }, [hasBeenFlushed, prefersReducedMotion, forceMotion]);

  useEffect(() => {
    if (!revealed || !celebrationActive || teams.length < 4 || (prefersReducedMotion && !forceMotion)) return;
    // A single multi-wave gag; preview brings it forward for testing.
    const delay = preview ? 4000 : 10000;
    let hideTimer: number | undefined;
    const showTimer = window.setTimeout(() => {
      setFlushBeat(0);
      setFlushVisible(true);
      setHasBeenFlushed(true);
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
          const isAffected = hasBeenFlushed && teamIndex >= 3;
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
          <div className="finale-header-final" style={{ visibility: celebrationActive ? "visible" : "hidden" }} aria-hidden={!celebrationActive}>
          <span className="finale-kicker">
            {preview ? "Finale preview" : "The final scores are in"}
          </span>
          <h1 id={celebrationActive ? "finale-title" : undefined}>That's a wrap!</h1>
          <p>
            {winner
              ? tiers[0]?.teamIds.length > 1 ? <>Make some noise for our <strong>joint winners</strong>!</> : <>Make some noise for <strong>{winner.name}</strong>!</>
              : "Your final podium will take the stage here."}
          </p>
          </div>
          {!celebrationActive && <div className="finale-header-pending">
            <span className="finale-kicker">From last place to the winner</span>
            <h1 id="finale-title">Final podium</h1>
            <p>The host controls every reveal.</p>
          </div>}
        </header>

        <section className="finale-podium" aria-label="Final podium">
          {podium.length > 0 ? podium.map((team, index) => {
            const accent = getTeamAccent(team);
            const rank = rankOf(team);
            const isPlaceVisible = visibleIds.has(team.id);
            const isLatestReveal = isPlaceVisible && latestIds.has(team.id);
            const intermediateRevealEmoji = rank === 1 ? ["🥇", "🏆", "✨", "🍾", "🥂", "🎉", "👑"]
              : rank === 2 ? ["🥈", "✨", "🎉", "🥂", "👏"] : ["🥉", "✨", "🎊", "👏", "🌟"];
            return (
              <article
                key={team.id}
                data-team-id={team.id}
                data-rank={rank}
                className={`finale-team finale-team-${index + 1}${isPlaceVisible ? " is-place-visible" : " is-place-concealed"}${isLatestReveal ? " is-latest-reveal" : ""}`}
                style={{
                  "--finale-team-base": accent.base,
                  "--finale-team-accent": accent.onLight,
                  "--finale-team-glow": accent.glow,
                } as CSSProperties}
              >
                <div className="finale-team-content" aria-hidden={!isPlaceVisible} style={isPlaceVisible ? undefined : { visibility: "hidden", opacity: 0, pointerEvents: "none" }}>
                    <span className="finale-medal" aria-label={`Place ${rank}`} role="img">
                      {podiumMedals[rank - 1] ?? "🎉"}
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
                  <div className="finale-place-concealed" aria-label={`${ordinalPlace(index + 1)} place is hidden`}>
                    <span className="finale-skeleton-medal" aria-hidden>✦</span>
                    <div className="finale-skeleton-identity" aria-hidden>
                      <span className="finale-skeleton-team">
                        <i />
                        <strong>{ordinalPlace(index + 1)} place</strong>
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
              </article>
            );
          }) : (
            <div className="finale-empty">Add teams to preview the full celebration.</div>
          )}
        </section>

        {teams.length > 3 && (
          <div className="finale-everyone">
            <span>{celebrationActive ? "And a huge cheer for" : "The remaining places"}</span>
            <div className="finale-encore-group">
              {teams.slice(3).map((team, index) => {
                const visible = visibleIds.has(team.id);
                const rank = rankOf(team);
                return <div className={`finale-encore-team${visible ? " is-place-visible" : " is-place-concealed"}${hasBeenFlushed ? " has-flush-residue" : ""}`} key={team.id} data-team-id={team.id} data-rank={rank}>
                  <div className="finale-encore-content" aria-hidden={!visible} style={visible ? undefined : { visibility: "hidden", opacity: 0, pointerEvents: "none" }}>
                    <span className="finale-encore-name"><span aria-hidden>{getTeamMarker(team)}</span> {team.name}</span>
                    <strong className="finale-encore-score">{ordinalPlace(rank)} · {team.score} pts</strong>
                    {renderPlayers(team, index + 3)}
                  </div>
                  {!visible && <span className="finale-encore-concealed">{ordinalPlace(index + 4)} place</span>}
                  {stagedReveal && visible && latestIds.has(team.id) && <span key={visiblePlaceCount} className="finale-encore-burst" aria-hidden>✨ 🎉 ✨</span>}
                  {hasBeenFlushed && <span className="finale-flush-residue" aria-hidden="true">
                    {Array.from({ length:24 }, (_, index) => <i key={index} style={{
                      left:`${3 + index * 94 / 23}%`,
                      bottom:`${index % 3}px`,
                      animationDelay:`${.8 + index % 8 * .35}s`,
                    }}>💩</i>)}
                  </span>}
                </div>;
              })}
              {flushVisible && (
                <div className="finale-flush" aria-hidden="true">
                  {["left", "right"].map(side => (
                    <div className={`finale-fountain ${side}`} key={side}>
                      <span className="finale-fountain-toilet">🚽</span>
                      <span className="finale-flush-swirl">🌀</span>
                      {Array.from({ length: 18 }, (_, index) => (
                        <span className="finale-fountain-flight" key={index} style={{
                          "--fountain-reach": `${18 + (index * 19 % 67)}%`,
                          "--fountain-height": `${85 + index % 4 * 14}px`,
                          "--fountain-land": `${28 + index % 3 * 12}px`,
                          "--fountain-delay": `${Math.floor(index / 6) * 1.15 + index % 6 * .14}s`,
                        } as CSSProperties}><span>💩</span></span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
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
                    ? `Music · ${music.remaining.toFixed(1)}s`
                    : music.status === "loading" || music.status === "preparing"
                      ? "Loading music…"
                      : music.status === "ended"
                        ? "Music ended"
                        : music.status === "error"
                          ? "Music unavailable"
                          : "Music ready"}
                </strong>
                {music.message && <small>{music.message}</small>}
              </div>
              {["ready", "blocked", "ended", "error", "idle"].includes(music.status) && (
                <button className="button finale-music-start" type="button" onClick={music.onStart} aria-label={music.status === "ended" ? "Replay music" : "Play music"}>
                  {music.status === "ended" ? "Replay" : "▶ Play"}
                </button>
              )}
            </div>
          )}
          {celebrationActive && prefersReducedMotion && (
            <button
              className="button finale-motion-toggle"
              type="button"
              onClick={() => setForceMotion((enabled) => !enabled)}
              aria-label={forceMotion ? "Pause animation" : "Resume animation"}
              title={forceMotion ? "Pause animation" : "Resume animation"}
            >
              {forceMotion ? "⏸ Effects" : "▶ Effects"}
            </button>
          )}
          <button className="button finale-close" type="button" onClick={onClose} autoFocus>
            Back to the board
          </button>
          {stagedReveal && !celebrationActive && nextStep && (
            <button
              className="button primary finale-place-reveal"
              type="button"
              onClick={onRevealNextPlace}
              onMouseEnter={onRevealCueStart}
              onMouseLeave={onRevealCueStop}
              onFocus={onRevealCueStart}
              onBlur={onRevealCueStop}
            >
              Reveal next
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
