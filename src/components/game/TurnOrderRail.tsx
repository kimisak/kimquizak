'use client';

import type { CSSProperties } from "react";
import type { Team } from "@/lib/types";
import { getTeamAccent, getTeamMarker } from "@/lib/teamPresentation";

type Props = {
  teams: Team[];
};

export function TurnOrderRail({ teams }: Props) {
  const [current, ...queued] = teams;
  if (!current) return null;

  const currentAccent = getTeamAccent(current);

  return (
    <div className="turn-order-track" aria-label="Board turn order">
      <div
        className="turn-order-current team-identity-surface"
        aria-current="step"
        aria-label={`Now, ${current.name}`}
        data-emoji-surface={currentAccent.emojiSurface}
        style={{
          "--turn-team-base": currentAccent.base,
          "--turn-team-color": currentAccent.onLight,
          "--turn-team-glow": currentAccent.glow,
          "--turn-team-tint": currentAccent.tint,
        } as CSSProperties}
      >
        <span className="turn-order-status">NOW</span>
        <span className="turn-order-identity">
          <span className="turn-order-emoji team-identity-emoji"><span aria-hidden>{getTeamMarker(current)}</span></span>
          <span className="turn-order-name">{current.name}</span>
        </span>
      </div>

      {queued.length > 0 && <span className="turn-order-transition" aria-hidden>✦</span>}

      <ol className="turn-order-queue" start={2} aria-label="Upcoming teams">
      {queued.map((team, queueIndex) => {
        const position = queueIndex + 2;
        const accent = getTeamAccent(team);
        const status = queueIndex === 0 ? "NEXT" : `${position}`;
        return (
          <li
            key={team.id}
            className={`${queueIndex === 0 ? "next " : ""}team-identity-surface`}
            aria-label={`${queueIndex === 0 ? "Next" : `Number ${position} in the queue`}, ${team.name}`}
            data-emoji-surface={accent.emojiSurface}
            style={{
              "--turn-team-base": accent.base,
              "--turn-team-color": accent.onLight,
              "--turn-team-glow": accent.glow,
              "--turn-team-tint": accent.tint,
            } as CSSProperties}
          >
            <span className="turn-order-status">{status}</span>
            <span className="turn-order-identity">
              <span className="turn-order-emoji team-identity-emoji"><span aria-hidden>{getTeamMarker(team)}</span></span>
              <span className="turn-order-name">{team.name}</span>
            </span>
            {queueIndex < queued.length - 1 && <span className="turn-order-arrow" aria-hidden>›</span>}
          </li>
        );
      })}
      </ol>
    </div>
  );
}
