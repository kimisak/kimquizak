import type { Team } from "@/lib/types";

export const HOST_MESSAGE_VARIABLES = [
  { token: "{team1}", label: "Team 1" },
  { token: "{team1.member1}", label: "Team 1 · member 1" },
  { token: "{random.team}", label: "Random team" },
  { token: "{random.player}", label: "Random player" },
] as const;

const VARIABLE_PATTERN = /\{([^{}]+)\}/g;

function teamName(team: Team | undefined, index: number) {
  return team?.name.trim() || `Team ${index + 1}`;
}

function playerName(team: Team | undefined, playerIndex: number) {
  const player = team?.players[playerIndex];
  return player?.name.trim() || player?.placeholder?.trim() || `Player ${playerIndex + 1}`;
}

export function getUnknownHostMessageVariables(template: string) {
  const unknown = new Set<string>();
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const variable = match[1].toLowerCase();
    if (
      variable === "random.team"
      || variable === "random.player"
      || /^team\d+$/.test(variable)
      || /^team\d+\.member\d+$/.test(variable)
    ) continue;
    unknown.add(match[0]);
  }
  return Array.from(unknown);
}

export function getUnavailableHostMessageVariables(template: string, teams: Team[]) {
  const unavailable = new Set<string>();
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const variable = match[1].toLowerCase();
    const memberMatch = variable.match(/^team(\d+)\.member(\d+)$/);
    const teamMatch = variable.match(/^team(\d+)$/);
    if (memberMatch) {
      const team = teams[Number(memberMatch[1]) - 1];
      const player = team?.players[Number(memberMatch[2]) - 1];
      if (!team || !player?.name.trim()) unavailable.add(match[0]);
    } else if (teamMatch) {
      if (!teams[Number(teamMatch[1]) - 1]) unavailable.add(match[0]);
    } else if (variable === "random.team" && teams.length === 0) {
      unavailable.add(match[0]);
    } else if (
      variable === "random.player"
      && !teams.some((team) => team.players.some((player) => player.name.trim()))
    ) {
      unavailable.add(match[0]);
    }
  }
  return Array.from(unavailable);
}

export function getHostMessageRandomPoolIssues(template: string, teams: Team[]) {
  const randomTeamDraws = template.match(/\{random\.team\}/gi)?.length ?? 0;
  const randomPlayerDraws = template.match(/\{random\.player\}/gi)?.length ?? 0;
  const namedPlayerCount = teams.reduce((count, team) => (
    count + team.players.filter((player) => player.name.trim()).length
  ), 0);
  const issues: string[] = [];

  if (randomTeamDraws > teams.length) {
    issues.push(`${randomTeamDraws} random team draws need ${randomTeamDraws} configured teams (currently ${teams.length}).`);
  }
  if (randomPlayerDraws > namedPlayerCount) {
    issues.push(`${randomPlayerDraws} random player draws need ${randomPlayerDraws} named players (currently ${namedPlayerCount}).`);
  }
  return issues;
}

export function createHostMessagePreviewRandom(seed: string) {
  let value = Array.from(seed).reduce((hash, character) => (
    Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0
  ), 2166136261);
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function resolveHostMessageTemplate(
  template: string,
  teams: Team[],
  random: () => number = Math.random,
) {
  const cache = new Map<string, string>();
  const availableTeams = teams.map((team, index) => ({
    value: teamName(team, index),
    teamId: team.id,
  }));
  const availablePlayers = teams.flatMap((team) => team.players
    .filter((player) => player.name.trim())
    .map((player) => ({
      value: player.name.trim(),
      teamId: team.id,
      playerId: player.id,
    })));
  const teamPool = [...availableTeams];
  const playerPool = [...availablePlayers];
  const randomSelections: Array<{
    kind: "team" | "player";
    value: string;
    candidates: string[];
    selectedIndex: number;
    teamId?: string;
    playerId?: string;
  }> = [];

  const drawWithoutReplacement = (
    pool: Array<{ value: string; teamId: string; playerId?: string }>,
    kind: "team" | "player",
  ) => {
    if (!pool.length) return kind === "team" ? "no other team" : "no other player";
    const candidates = pool.map((candidate) => candidate.value);
    const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    const [selection] = pool.splice(index, 1);
    randomSelections.push({
      kind,
      value: selection.value,
      candidates,
      selectedIndex: index,
      teamId: selection.teamId,
      playerId: selection.playerId,
    });
    return selection.value;
  };

  const resolveVariable = (rawVariable: string) => {
    const variable = rawVariable.toLowerCase();
    if (variable === "random.team") return drawWithoutReplacement(teamPool, "team");
    if (variable === "random.player") return drawWithoutReplacement(playerPool, "player");
    const cached = cache.get(variable);
    if (cached) return cached;

    const memberMatch = variable.match(/^team(\d+)\.member(\d+)$/);
    const teamMatch = variable.match(/^team(\d+)$/);
    let resolved = "—";
    if (memberMatch) {
      const teamIndex = Number(memberMatch[1]) - 1;
      const memberIndex = Number(memberMatch[2]) - 1;
      resolved = teamIndex >= 0 && memberIndex >= 0 && teams[teamIndex]
        ? playerName(teams[teamIndex], memberIndex)
        : "unknown player";
    } else if (teamMatch) {
      const teamIndex = Number(teamMatch[1]) - 1;
      resolved = teamIndex >= 0 && teams[teamIndex]
        ? teamName(teams[teamIndex], teamIndex)
        : "unknown team";
    }
    cache.set(variable, resolved);
    return resolved;
  };

  const text = template.replace(VARIABLE_PATTERN, (_, variable: string) => resolveVariable(variable));
  return { text, variables: Object.fromEntries(cache), randomSelections };
}
