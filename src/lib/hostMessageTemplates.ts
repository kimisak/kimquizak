import type { Team } from "@/lib/types";

export const HOST_MESSAGE_VARIABLES = [
  { token: "{team1}", label: "Team 1" },
  { token: "{team1.member1}", label: "Team 1 · member 1" },
  { token: "{random.team}", label: "Random team" },
  { token: "{random.player}", label: "Random player" },
  { token: "{males}", label: "All male players" },
  { token: "{females}", label: "All female players" },
  { token: "{random.male}", label: "One random male player" },
  { token: "{random.female}", label: "One random female player" },
  { token: "{1-10}", label: "Random number from 1 to 10" },
  { token: "{5m}", label: "Five-minute countdown" },
] as const;

const VARIABLE_PATTERN = /\{([^{}]+)\}/g;
const NUMBER_RANGE_PATTERN = /^(-?\d+)\s*-\s*(-?\d+)$/;
const COUNTDOWN_PATTERN = /^(?:(\d+)m)?(?:(\d+)s)?$/i;
export const MAX_WHEEL_NUMBER_RANGE = 24;

export function parseHostMessageNumberRange(variable: string) {
  const match = variable.trim().match(NUMBER_RANGE_PATTERN);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null;
  return { start, end, size: Math.abs(end - start) + 1 };
}

export function parseHostMessageCountdown(variable: string) {
  const match = variable.trim().match(COUNTDOWN_PATTERN);
  if (!match || (!match[1] && !match[2])) return null;
  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2] ?? 0);
  const totalSeconds = minutes * 60 + seconds;
  return Number.isSafeInteger(totalSeconds) && totalSeconds > 0 ? totalSeconds : null;
}

export function formatHostMessageCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function hasRandomHostMessageVariable(template: string) {
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const variable = match[1].toLowerCase();
    if (
      variable === "random.team"
      || variable === "random.player"
      || variable === "random.male"
      || variable === "random.female"
      || parseHostMessageNumberRange(variable)
    ) return true;
  }
  return false;
}

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
      || variable === "random.male"
      || variable === "random.female"
      || variable === "males"
      || variable === "females"
      || parseHostMessageNumberRange(variable)
      || parseHostMessageCountdown(variable)
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
      (variable === "random.player" || variable === "random.male" || variable === "random.female")
      && !teams.some((team) => team.players.some((player) => (
        player.name.trim()
        && (variable === "random.player"
          || player.gender === (variable === "random.male" ? "M" : "F"))
      )))
    ) {
      unavailable.add(match[0]);
    } else if (
      (variable === "males" || variable === "females")
      && !teams.some((team) => team.players.some((player) => (
        player.name.trim() && player.gender === (variable === "males" ? "M" : "F")
      )))
    ) {
      unavailable.add(match[0]);
    }
  }
  return Array.from(unavailable);
}

export function getHostMessageRandomPoolIssues(template: string, teams: Team[]) {
  const randomTeamDraws = template.match(/\{random\.team\}/gi)?.length ?? 0;
  const randomPlayerDraws = template.match(/\{random\.player\}/gi)?.length ?? 0;
  const randomMaleDraws = template.match(/\{random\.male\}/gi)?.length ?? 0;
  const randomFemaleDraws = template.match(/\{random\.female\}/gi)?.length ?? 0;
  const namedPlayerCount = teams.reduce((count, team) => (
    count + team.players.filter((player) => player.name.trim()).length
  ), 0);
  const issues: string[] = [];

  if (randomTeamDraws > teams.length) {
    issues.push(`${randomTeamDraws} random team draws need ${randomTeamDraws} configured teams (currently ${teams.length}).`);
  }
  const totalRandomPlayerDraws = randomPlayerDraws + randomMaleDraws + randomFemaleDraws;
  if (totalRandomPlayerDraws > namedPlayerCount) {
    issues.push(`${totalRandomPlayerDraws} random player draws need ${totalRandomPlayerDraws} named players (currently ${namedPlayerCount}).`);
  }
  const malePlayerCount = teams.reduce((count, team) => (
    count + team.players.filter((player) => player.name.trim() && player.gender === "M").length
  ), 0);
  const femalePlayerCount = teams.reduce((count, team) => (
    count + team.players.filter((player) => player.name.trim() && player.gender === "F").length
  ), 0);
  if (randomMaleDraws > malePlayerCount) {
    issues.push(`${randomMaleDraws} random male draws need ${randomMaleDraws} male players (currently ${malePlayerCount}).`);
  }
  if (randomFemaleDraws > femalePlayerCount) {
    issues.push(`${randomFemaleDraws} random female draws need ${randomFemaleDraws} female players (currently ${femalePlayerCount}).`);
  }
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const range = parseHostMessageNumberRange(match[1]);
    if (range && range.size > MAX_WHEEL_NUMBER_RANGE) {
      issues.push(`${match[0]} contains ${range.size.toLocaleString()} numbers. Ranges above ${MAX_WHEEL_NUMBER_RANGE} reveal directly instead of using the wheel.`);
    }
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
      gender: player.gender,
    })));
  const teamPool = [...availableTeams];
  const playerPool = [...availablePlayers];
  const malePlayerPool = availablePlayers.filter((candidate) => candidate.gender === "M");
  const femalePlayerPool = availablePlayers.filter((candidate) => candidate.gender === "F");
  let remainingMaleDraws = template.match(/\{random\.male\}/gi)?.length ?? 0;
  let remainingFemaleDraws = template.match(/\{random\.female\}/gi)?.length ?? 0;
  const randomSelections: Array<{
    kind: "team" | "player" | "number";
    value: string;
    candidates: string[];
    selectedIndex: number;
    teamId?: string;
    playerId?: string;
    rangeStart?: number;
    rangeEnd?: number;
  }> = [];

  const drawWithoutReplacement = (
    pool: Array<{ value: string; teamId: string; playerId?: string; gender?: "M" | "F" }>,
    kind: "team" | "player",
    reserveGenderPools = false,
  ) => {
    if (!pool.length) return kind === "team" ? "no other team" : "no other player";
    const eligiblePool = reserveGenderPools
      ? pool.filter((candidate) => (
          candidate.gender === "M"
            ? malePlayerPool.length > remainingMaleDraws
            : candidate.gender === "F"
              ? femalePlayerPool.length > remainingFemaleDraws
              : true
        ))
      : pool;
    const drawPool = eligiblePool.length > 0 ? eligiblePool : pool;
    const candidates = drawPool.map((candidate) => candidate.value);
    const selectedIndex = Math.min(drawPool.length - 1, Math.floor(random() * drawPool.length));
    const selection = drawPool[selectedIndex];
    if (kind === "player" && selection.playerId) {
      [playerPool, malePlayerPool, femalePlayerPool].forEach((candidatePool) => {
        const duplicateIndex = candidatePool.findIndex((candidate) => candidate.playerId === selection.playerId);
        if (duplicateIndex >= 0) candidatePool.splice(duplicateIndex, 1);
      });
    } else {
      const index = pool.findIndex((candidate) => candidate.teamId === selection.teamId);
      if (index >= 0) pool.splice(index, 1);
    }
    randomSelections.push({
      kind,
      value: selection.value,
      candidates,
      selectedIndex,
      teamId: selection.teamId,
      playerId: selection.playerId,
    });
    return selection.value;
  };

  const resolveVariable = (rawVariable: string) => {
    const variable = rawVariable.toLowerCase();
    if (variable === "random.team") return drawWithoutReplacement(teamPool, "team");
    if (variable === "random.player") return drawWithoutReplacement(playerPool, "player", true);
    if (variable === "random.male") {
      remainingMaleDraws = Math.max(0, remainingMaleDraws - 1);
      return drawWithoutReplacement(malePlayerPool, "player");
    }
    if (variable === "random.female") {
      remainingFemaleDraws = Math.max(0, remainingFemaleDraws - 1);
      return drawWithoutReplacement(femalePlayerPool, "player");
    }
    const numberRange = parseHostMessageNumberRange(variable);
    if (numberRange) {
      const selectedIndex = Math.min(
        numberRange.size - 1,
        Math.floor(random() * numberRange.size),
      );
      const direction = numberRange.end >= numberRange.start ? 1 : -1;
      const value = String(numberRange.start + selectedIndex * direction);
      const candidates = numberRange.size <= MAX_WHEEL_NUMBER_RANGE
        ? Array.from({ length: numberRange.size }, (_, index) => (
          String(numberRange.start + index * direction)
        ))
        : [];
      randomSelections.push({
        kind: "number",
        value,
        candidates,
        selectedIndex,
        rangeStart: numberRange.start,
        rangeEnd: numberRange.end,
      });
      return value;
    }
    const countdownSeconds = parseHostMessageCountdown(variable);
    if (countdownSeconds) return formatHostMessageCountdown(countdownSeconds);
    const cached = cache.get(variable);
    if (cached) return cached;

    if (variable === "males" || variable === "females") {
      const gender = variable === "males" ? "M" : "F";
      const names = teams.flatMap((team) => team.players
        .filter((player) => player.gender === gender && player.name.trim())
        .map((player) => player.name.trim()));
      const resolved = names.length > 0
        ? names.join(", ")
        : `no ${variable}`;
      cache.set(variable, resolved);
      return resolved;
    }

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
