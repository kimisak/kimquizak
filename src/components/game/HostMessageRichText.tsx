'use client';

import { TeamEmoji } from "./TeamEmoji";
import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { getTeamAccent, getTeamMarker } from "@/lib/teamPresentation";
import {
  formatHostMessageCountdown,
  parseHostMessageCountdown,
  parseHostMessageNumberRange,
} from "@/lib/hostMessageTemplates";
import type { ResolvedHostMessage, Team } from "@/lib/types";

type Props = {
  template: string;
  resolution: ResolvedHostMessage;
  teams: Team[];
  countdownsActive?: boolean;
};

type MessagePart = {
  value: string;
  kind?: "team" | "player" | "player-group" | "number" | "countdown";
  team?: Team;
  groupPlayers?: Array<{ id: string; name: string; team: Team }>;
  countdownSeconds?: number;
};

const VARIABLE_PATTERN = /\{([^{}]+)\}/g;

function findPlayerTeam(teams: Team[], playerId: string | undefined, playerName: string) {
  return teams.find((team) => team.players.some((player) => (
    playerId ? player.id === playerId : player.name.trim() === playerName
  )));
}

function createMessageParts(template: string, resolution: ResolvedHostMessage, teams: Team[]) {
  const parts: MessagePart[] = [];
  let cursor = 0;
  let randomSelectionIndex = 0;

  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const offset = match.index ?? 0;
    if (offset > cursor) parts.push({ value: template.slice(cursor, offset) });

    const variable = match[1].toLowerCase();
    const memberMatch = variable.match(/^team(\d+)\.member(\d+)$/);
    const teamMatch = variable.match(/^team(\d+)$/);
    const numberRange = parseHostMessageNumberRange(variable);
    const countdownSeconds = parseHostMessageCountdown(variable);
    let value = resolution.variables[variable] ?? match[0];
    let kind: MessagePart["kind"];
    let team: Team | undefined;

    if (countdownSeconds) {
      value = formatHostMessageCountdown(countdownSeconds);
      kind = "countdown";
    } else if (variable === "males" || variable === "females") {
      const gender = variable === "males" ? "M" : "F";
      const groupPlayers = teams.flatMap((candidateTeam) => candidateTeam.players
        .filter((player) => player.gender === gender && player.name.trim())
        .map((player) => ({
          id: player.id,
          name: player.name.trim(),
          team: candidateTeam,
        })));
      parts.push({ value, kind: "player-group", groupPlayers });
      cursor = offset + match[0].length;
      continue;
    } else if (
      variable === "random.team"
      || variable === "random.player"
      || variable === "random.male"
      || variable === "random.female"
      || numberRange
    ) {
      const selection = resolution.randomSelections?.[randomSelectionIndex];
      randomSelectionIndex += 1;
      value = selection?.value ?? resolution.variables[variable] ?? match[0];
      kind = numberRange ? "number" : variable === "random.team" ? "team" : "player";
      team = selection?.teamId
        ? teams.find((candidate) => candidate.id === selection.teamId)
        : kind === "team"
          ? teams.find((candidate, index) => (candidate.name.trim() || `Team ${index + 1}`) === value)
          : findPlayerTeam(teams, selection?.playerId, value);
    } else if (memberMatch) {
      kind = "player";
      team = teams[Number(memberMatch[1]) - 1];
    } else if (teamMatch) {
      kind = "team";
      team = teams[Number(teamMatch[1]) - 1];
    }

    parts.push({ value, kind, team, countdownSeconds: countdownSeconds ?? undefined });
    cursor = offset + match[0].length;
  }

  if (cursor < template.length) parts.push({ value: template.slice(cursor) });
  return parts;
}

function HostMessageCountdown({ seconds, active }: { seconds: number; active: boolean }) {
  const [remaining, setRemaining] = useState(seconds);
  const initialLabel = formatHostMessageCountdown(seconds);

  useEffect(() => {
    if (!active) return;
    const deadline = Date.now() + seconds * 1000;
    const timer = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) window.clearInterval(timer);
    }, 200);
    return () => window.clearInterval(timer);
  }, [active, seconds]);

  const displayedSeconds = active ? remaining : seconds;
  return (
    <span
      className={`host-message-entity host-message-countdown${displayedSeconds === 0 ? " complete" : ""}`}
      role="timer"
      aria-label={`${displayedSeconds} seconds remaining`}
      style={{ width: `${Math.max(3.55, initialLabel.length * 0.62 + 0.6)}em` }}
    >
      <span className="host-message-entity-name">{formatHostMessageCountdown(displayedSeconds)}</span>
    </span>
  );
}

export function HostMessageRichText({ template, resolution, teams, countdownsActive = false }: Props) {
  const parts = createMessageParts(template, resolution, teams);

  return parts.map((part, index) => {
    if (part.kind === "countdown" && part.countdownSeconds) {
      return <HostMessageCountdown key={index} seconds={part.countdownSeconds} active={countdownsActive} />;
    }
    if (part.kind === "number") {
      return (
        <span className="host-message-entity host-message-number" key={index}>
          <span className="host-message-entity-name">{part.value}</span>
        </span>
      );
    }
    if (part.kind === "player-group") {
      const groupPlayers = part.groupPlayers ?? [];
      const density = groupPlayers.length > 16
        ? " is-crowded"
        : groupPlayers.length > 10
          ? " is-dense"
          : groupPlayers.length > 6
            ? " is-compact"
            : "";
      return (
        <span
          className={`host-message-player-group${density}`}
          key={index}
          role="group"
          aria-label={groupPlayers.map((player) => player.name).join(", ")}
        >
          {groupPlayers.map((player) => {
            const accent = getTeamAccent(player.team);
            return (
              <span
                className="host-message-entity host-message-player"
                key={player.id}
                style={{
                  "--host-entity-base": accent.base,
                  "--host-entity-color": accent.glow,
                  "--host-entity-contrast": accent.onDark,
                  "--host-entity-tint": accent.tint,
                } as CSSProperties}
              >
                <span className="host-message-entity-emoji" aria-hidden><TeamEmoji emoji={getTeamMarker(player.team)} color={getTeamAccent(player.team).base} /></span>
                <span className="host-message-entity-name">{player.name}</span>
              </span>
            );
          })}
        </span>
      );
    }
    if (!part.kind || !part.team) return <Fragment key={index}>{part.value}</Fragment>;
    const accent = getTeamAccent(part.team);
    const density = part.value.length > 28
      ? " host-message-entity-xlong"
      : part.value.length > 18
        ? " host-message-entity-long"
        : "";
    return (
      <span
        className={`host-message-entity host-message-${part.kind}${density}`}
        key={index}
        style={{
          "--host-entity-base": accent.base,
          "--host-entity-color": accent.glow,
          "--host-entity-contrast": accent.onDark,
          "--host-entity-tint": accent.tint,
        } as CSSProperties}
      >
        <span className="host-message-entity-emoji" aria-hidden><TeamEmoji emoji={getTeamMarker(part.team)} color={getTeamAccent(part.team).base} /></span>
        <span className="host-message-entity-name">{part.value}</span>
      </span>
    );
  });
}
