'use client';

import { Fragment, type CSSProperties } from "react";
import { getTeamAccent, getTeamMarker } from "@/lib/teamPresentation";
import type { ResolvedHostMessage, Team } from "@/lib/types";

type Props = {
  template: string;
  resolution: ResolvedHostMessage;
  teams: Team[];
};

type MessagePart = {
  value: string;
  kind?: "team" | "player";
  team?: Team;
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
    let value = resolution.variables[variable] ?? match[0];
    let kind: MessagePart["kind"];
    let team: Team | undefined;

    if (variable === "random.team" || variable === "random.player") {
      const selection = resolution.randomSelections?.[randomSelectionIndex];
      randomSelectionIndex += 1;
      value = selection?.value ?? resolution.variables[variable] ?? match[0];
      kind = variable === "random.team" ? "team" : "player";
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

    parts.push({ value, kind, team });
    cursor = offset + match[0].length;
  }

  if (cursor < template.length) parts.push({ value: template.slice(cursor) });
  return parts;
}

export function HostMessageRichText({ template, resolution, teams }: Props) {
  const parts = createMessageParts(template, resolution, teams);

  return parts.map((part, index) => {
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
        <span className="host-message-entity-emoji" aria-hidden>{getTeamMarker(part.team)}</span>
        <span className="host-message-entity-name">{part.value}</span>
      </span>
    );
  });
}
