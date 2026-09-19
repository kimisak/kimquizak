'use client';

import { useCallback, useEffect, useState, type CSSProperties, type DragEvent } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useSettings } from "@/hooks/useSettings";
import {
  LEGACY_TEAM_STORAGE_KEY,
  TEAM_STORAGE_KEY,
} from "@/lib/storage";
import type { Player, PlayerBondKind, PlayerGender, Team } from "@/lib/types";
import {
  buildDefaultTeams,
  getThemeById,
  getThemeOptions,
  makeId,
} from "@/lib/defaultData";
import { EditableTeamPill } from "@/components/game/TeamPill";
import { getTeamAccent, reconcileTeamTheme } from "@/lib/teamPresentation";
import { normalizePlayerBondKind, PLAYER_BOND_OPTIONS } from "@/lib/playerBonds";

const getDefaultPlayerNumber = (player: Player) => {
  const match = /^Player\s+(\d+)$/i.exec(
    (player.placeholder || player.name).trim(),
  );
  return match ? Number(match[1]) : null;
};

const getAvailableDefaultPlayerNumbers = (teams: Team[], count: number) => {
  const usedNumbers = new Set(
    teams.flatMap((team) =>
      team.players.flatMap((player) => {
        const playerNumber = getDefaultPlayerNumber(player);
        return playerNumber === null ? [] : [playerNumber];
      }),
    ),
  );
  const availableNumbers: number[] = [];

  for (let candidate = 1; availableNumbers.length < count; candidate += 1) {
    if (!usedNumbers.has(candidate)) availableNumbers.push(candidate);
  }

  return availableNumbers;
};

const shuffleArray = <T,>(arr: T[]) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

type ImportedPlayer = {
  name: string;
  gender: PlayerGender;
  bondKind?: PlayerBondKind;
  partnerName?: string;
};

const normalizePersonName = (name: string) => name.trim().toLocaleLowerCase();

const parseBondAndPartner = (value: string) => {
  const normalized = value.trim().toLocaleLowerCase();
  const optionAliases: Array<{ label: string; kind: PlayerBondKind }> = PLAYER_BOND_OPTIONS.flatMap((option) => [
    { label: option.label, kind: option.value },
    { label: option.value.replaceAll("-", " "), kind: option.value },
  ]);
  const aliases: Array<{ label: string; kind: PlayerBondKind }> = [
    ...optionAliases,
    { label: "Sweetheart", kind: "sweethearts" as PlayerBondKind },
    { label: "Drinking buddy", kind: "drinking-buddies" as PlayerBondKind },
  ].sort((first, second) => second.label.length - first.label.length);
  const match = aliases.find(({ label }) => {
    const normalizedLabel = label.toLocaleLowerCase();
    return normalized === normalizedLabel || normalized.startsWith(`${normalizedLabel} `);
  });
  if (!match) return null;
  const partnerName = value.trim().slice(match.label.length).replace(/^\s*,?\s*/, "").trim();
  return { kind: match.kind, partnerName };
};

const parsePlayerImport = (value: string): { players: ImportedPlayer[]; errors: string[] } => {
  const players: ImportedPlayer[] = [];
  const errors: string[] = [];
  const seenNames = new Set<string>();

  value.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const parts = line.split(",").map((part) => part.trim()).filter(Boolean);
    const name = parts[0] ?? "";
    const gender = parts[1]?.toUpperCase();
    if (!name || (gender !== "M" && gender !== "F")) {
      errors.push(`Line ${index + 1}: use Name, M/F`);
      return;
    }
    const normalizedName = normalizePersonName(name);
    if (seenNames.has(normalizedName)) {
      errors.push(`Line ${index + 1}: ${name} is listed twice; use unique names such as Bob A and Bob B`);
      return;
    }
    seenNames.add(normalizedName);

    const relationText = parts[2] ?? "";
    if (!relationText) {
      players.push({ name, gender });
      return;
    }
    const parsedRelation = parseBondAndPartner(relationText);
    const partnerName = parts.length >= 4
      ? parts.slice(3).join(", ").trim()
      : parsedRelation?.partnerName ?? "";
    if (!parsedRelation || !partnerName) {
      errors.push(`Line ${index + 1}: add a supported relationship and partner name`);
      return;
    }
    players.push({
      name,
      gender,
      bondKind: parsedRelation.kind,
      partnerName,
    });
  });

  return { players, errors };
};

const allocateProportionalQuotas = (count: number, capacities: number[]) => {
  const totalCapacity = capacities.reduce((sum, capacity) => sum + capacity, 0);
  if (count <= 0 || totalCapacity <= 0) return capacities.map(() => 0);

  const allocations = capacities.map((capacity) => Math.floor((count * capacity) / totalCapacity));
  let remaining = count - allocations.reduce((sum, allocation) => sum + allocation, 0);
  const rankedTeams = shuffleArray(capacities.map((capacity, index) => {
    const exactShare = (count * capacity) / totalCapacity;
    return { index, remainder: exactShare - Math.floor(exactShare) };
  })).sort((first, second) => second.remainder - first.remainder);

  for (const team of rankedTeams) {
    if (remaining <= 0) break;
    if (allocations[team.index] >= capacities[team.index]) continue;
    allocations[team.index] += 1;
    remaining -= 1;
  }
  return allocations;
};

const distributePlayersByGender = (players: Player[], capacities: number[]) => {
  const result = capacities.map(() => [] as Player[]);
  const remainingCapacities = [...capacities];
  const genderGroups = shuffleArray([
    { gender: "F" as const, players: players.filter((player) => player.gender === "F") },
    { gender: "M" as const, players: players.filter((player) => player.gender === "M") },
  ]).sort((first, second) => second.players.length - first.players.length);

  genderGroups.forEach((group) => {
    const shuffledPlayers = shuffleArray(group.players);
    const quotas = allocateProportionalQuotas(shuffledPlayers.length, remainingCapacities);
    let cursor = 0;
    quotas.forEach((quota, teamIndex) => {
      result[teamIndex].push(...shuffledPlayers.slice(cursor, cursor + quota));
      cursor += quota;
      remainingCapacities[teamIndex] -= quota;
    });
  });

  const ungenderedPlayers = shuffleArray(players.filter((player) => player.gender !== "F" && player.gender !== "M"));
  let ungenderedCursor = 0;
  remainingCapacities.forEach((capacity, teamIndex) => {
    result[teamIndex].push(...ungenderedPlayers.slice(ungenderedCursor, ungenderedCursor + capacity));
    ungenderedCursor += capacity;
  });

  return result.map((teamPlayers) => shuffleArray(teamPlayers));
};

const getPlayerBonds = (player: Player) => (
  player.bonds ?? (player.bond ? [player.bond] : [])
);

const sanitizePlayerBonds = (teams: Team[]) => {
  const players = new Map(teams.flatMap((team) => team.players.map((player) => [player.id, player] as const)));
  let changed = false;
  const sanitized = teams.map((team) => ({
    ...team,
    players: team.players.map((player) => {
      const declaredBonds = getPlayerBonds(player);
      const seenPartners = new Set<string>();
      const validBonds = declaredBonds.flatMap((bond) => {
        const kind = normalizePlayerBondKind(bond.kind);
        const partner = players.get(bond.playerId);
        const reciprocal = partner && getPlayerBonds(partner).some((candidate) => (
          candidate.playerId === player.id && normalizePlayerBondKind(candidate.kind) === kind
        ));
        if (!kind || !partner || partner.id === player.id || !reciprocal || seenPartners.has(partner.id)) {
          return [];
        }
        seenPartners.add(partner.id);
        return [{ playerId: bond.playerId, kind }];
      });
      const needsUpdate = player.bond !== undefined
        || validBonds.length !== (player.bonds?.length ?? 0)
        || validBonds.some((bond, index) => (
          bond.playerId !== player.bonds?.[index]?.playerId
          || bond.kind !== player.bonds?.[index]?.kind
        ));
      if (!needsUpdate) return player;
      changed = true;
      return {
        ...player,
        bonds: validBonds.length ? validBonds : undefined,
        bond: undefined,
      };
    }),
  }));
  return changed ? sanitized : teams;
};

const withPlayerBond = (player: Player, partnerId: string, kind: PlayerBondKind): Player => ({
  ...player,
  bonds: [
    ...getPlayerBonds(player).filter((bond) => bond.playerId !== partnerId),
    { playerId: partnerId, kind },
  ],
  bond: undefined,
});

const withoutPlayerBond = (player: Player, partnerId: string): Player => {
  const bonds = getPlayerBonds(player).filter((bond) => bond.playerId !== partnerId);
  return {
    ...player,
    bonds: bonds.length ? bonds : undefined,
    bond: undefined,
  };
};

export default function TeamConfigPage() {
  const [settings] = useSettings();
  const [teams, setTeams, teamsHydrated] = usePersistentState<Team[]>(
    TEAM_STORAGE_KEY,
    [],
    [LEGACY_TEAM_STORAGE_KEY],
  );
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleMillisLeft, setShuffleMillisLeft] = useState<number | null>(null);
  const [balanceGenderMix, setBalanceGenderMix] = useState(true);
  const [connectionFromId, setConnectionFromId] = useState("");
  const [connectionToId, setConnectionToId] = useState("");
  const [connectionKind, setConnectionKind] = useState<PlayerBondKind>("drinking-buddies");
  const [connectionsOpenOverride, setConnectionsOpenOverride] = useState<boolean | null>(null);
  const [playerImportText, setPlayerImportText] = useState("");
  const [playerImportFeedback, setPlayerImportFeedback] = useState("");
  const [playerImportFeedbackKind, setPlayerImportFeedbackKind] = useState<"error" | "success">("error");
  const [distributionTeamCount, setDistributionTeamCount] = useState(3);
  const [draggedPlayer, setDraggedPlayer] = useState<{ playerId: string; teamId: string } | null>(null);
  const [dropTeamId, setDropTeamId] = useState<string | null>(null);
  const [dropPlayerId, setDropPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (teamsHydrated && teams.length === 0) {
      setTeams(buildDefaultTeams(settings.themeId));
    }
  }, [teams.length, teamsHydrated, setTeams, settings.themeId]);

  useEffect(() => {
    if (!teamsHydrated || teams.length === 0) return;
    setTeams((previous) => {
      let changed = false;
      const reconciled = previous.map((team) => {
        let playersChanged = false;
        const normalizedPlayers = team.players.map((player) => {
          if (player.placeholder || !/^Player\s+\d+$/i.test(player.name.trim())) {
            return player;
          }
          playersChanged = true;
          changed = true;
          return { ...player, name: "", placeholder: player.name.trim() };
        });
        const normalizedTeam = playersChanged ? { ...team, players: normalizedPlayers } : team;
        const next = reconcileTeamTheme(normalizedTeam, settings.themeId);
        if (next !== team) changed = true;
        return next;
      });
      const sanitized = sanitizePlayerBonds(reconciled);
      return changed || sanitized !== reconciled ? sanitized : previous;
    });
  }, [teamsHydrated, settings.themeId, setTeams, teams.length]);

  const shufflePlayersAcrossTeams = useCallback(() => {
    setTeams((prev) => {
      const allPlayers = prev.flatMap((team) => team.players);
      if (!allPlayers.some((player) => player.name.trim())) return prev;
      const capacities = prev.map((team) => team.players.length);
      const distributedPlayers = balanceGenderMix
        ? distributePlayersByGender(allPlayers, capacities)
        : (() => {
            const shuffledPlayers = shuffleArray(allPlayers);
            let cursor = 0;
            return capacities.map((capacity) => {
              const teamPlayers = shuffledPlayers.slice(cursor, cursor + capacity);
              cursor += capacity;
              return teamPlayers;
            });
          })();
      return prev.map((team, teamIndex) => ({
        ...team,
        players: distributedPlayers[teamIndex].map((player, playerIndex) => {
          const slot = team.players[playerIndex];
          return {
            ...player,
            placeholder: slot?.placeholder ?? player.placeholder,
          };
        }),
      }));
    });
  }, [balanceGenderMix, setTeams]);

  const startShuffling = () => {
    if (isShuffling || !teams.some((team) => team.players.some((player) => player.name.trim()))) return;
    const duration = Math.max(1, Math.min(10, Math.floor(Math.random() * 10) + 1));
    setShuffleMillisLeft(duration * 1000);
    setIsShuffling(true);
    shufflePlayersAcrossTeams();
  };

  useEffect(() => {
    if (!isShuffling || shuffleMillisLeft === null) return;
    const id = setTimeout(() => {
      if (shuffleMillisLeft <= 0) {
        setIsShuffling(false);
        setShuffleMillisLeft(null);
        return;
      }
      shufflePlayersAcrossTeams();
      setShuffleMillisLeft((prev) => (prev !== null ? prev - 500 : prev));
    }, 500);
    return () => clearTimeout(id);
  }, [isShuffling, shuffleMillisLeft, shufflePlayersAcrossTeams]);

  const shuffleLabel = () => {
    if (!isShuffling) return "Shuffle players across teams";
    const seconds = shuffleMillisLeft !== null ? Math.max(shuffleMillisLeft, 0) / 1000 : 0;
    return `Shuffling… ${seconds.toFixed(1)}s`;
  };

  if (!teamsHydrated) {
    return (
      <main className="admin-page teams-page">
        <h1 style={{ margin: 0 }}>Teams & Players</h1>
        <p style={{ color: "var(--muted)", marginTop: "6px" }}>Loading…</p>
      </main>
    );
  }

  const handleTeamNameChange = (teamId: string, name: string) => {
    setTeams((prev) =>
      prev.map((team) => (team.id === teamId ? { ...team, name } : team)),
    );
  };

  const handlePlayerNameChange = (
    teamId: string,
    playerId: string,
    name: string,
  ) => {
    setTeams((prev) =>
      prev.map((team) =>
        team.id === teamId
          ? {
              ...team,
              players: team.players.map((p) =>
                p.id === playerId ? { ...p, name } : p,
              ),
            }
          : team,
      ),
    );
  };

  const addPlayer = (teamId: string) => {
    setTeams((prev) => {
      const [nextPlayerNumber] = getAvailableDefaultPlayerNumbers(prev, 1);
      return prev.map((team) =>
        team.id === teamId
          ? {
              ...team,
              players: [
                ...team.players,
                { id: makeId("p"), name: "", placeholder: `Player ${nextPlayerNumber}` },
              ],
            }
          : team,
      );
    });
  };

  const removePlayer = (teamId: string, playerId: string) => {
    setTeams((prev) =>
      sanitizePlayerBonds(prev.map((team) => {
        if (team.id !== teamId) return team;

        const removedPlayer = team.players.find((player) => player.id === playerId);
        const removedPlayerNumber = removedPlayer
          ? getDefaultPlayerNumber(removedPlayer)
          : null;
        const remainingPlayers = team.players
          .filter((player) => player.id !== playerId)
          .map((player) => {
            const playerNumber = getDefaultPlayerNumber(player);
            if (
              removedPlayerNumber === null ||
              playerNumber === null ||
              playerNumber <= removedPlayerNumber
            ) {
              return player;
            }
            return { ...player, placeholder: `Player ${playerNumber - 1}` };
          });

        return { ...team, players: remainingPlayers };
      })),
    );
  };

  const distributeImportedPlayers = () => {
    const parsed = parsePlayerImport(playerImportText);
    if (parsed.errors.length > 0) {
      setPlayerImportFeedbackKind("error");
      setPlayerImportFeedback(parsed.errors.join(" · "));
      return;
    }
    if (parsed.players.length === 0 || teams.length === 0) return;
    const existingNames = new Set(
      teams.flatMap((team) => team.players)
        .filter((player) => player.name.trim())
        .map((player) => normalizePersonName(player.name)),
    );
    const updatedPlayerCount = parsed.players.filter((player) => (
      existingNames.has(normalizePersonName(player.name))
    )).length;
    const createdPlayerCount = parsed.players.length - updatedPlayerCount;
    const availableNames = new Set([
      ...existingNames,
      ...parsed.players.map((player) => normalizePersonName(player.name)),
    ]);
    const unresolved = parsed.players.find((player) => (
      player.partnerName && !availableNames.has(normalizePersonName(player.partnerName))
    ));
    if (unresolved?.partnerName) {
      setPlayerImportFeedbackKind("error");
      setPlayerImportFeedback(`Could not find ${unresolved.partnerName}, referenced by ${unresolved.name}.`);
      return;
    }

    setTeams((previous) => {
      const selectedCount = Math.max(1, Math.min(distributionTeamCount, previous.length));
      const selectedIds = new Set(previous.slice(0, selectedCount).map((team) => team.id));
      const draftByName = new Map(parsed.players.map((player) => [normalizePersonName(player.name), player] as const));
      const previousNames = new Set(
        previous.flatMap((team) => team.players)
          .filter((player) => player.name.trim())
          .map((player) => normalizePersonName(player.name)),
      );
      const playersToCreate = parsed.players.filter((player) => !previousNames.has(normalizePersonName(player.name)));
      const next = previous.map((team) => ({
        ...team,
        players: team.players
          .filter((player) => !selectedIds.has(team.id) || player.name.trim())
          .map((player) => {
            const draft = draftByName.get(normalizePersonName(player.name));
            return draft
              ? { ...player, name: draft.name, gender: draft.gender }
              : player;
          }),
      }));
      const playerNumbers = getAvailableDefaultPlayerNumbers(next, playersToCreate.length);
      const importedPlayers = playersToCreate.map((player, index) => ({
        id: makeId("p"),
        name: player.name,
        gender: player.gender,
        placeholder: `Player ${playerNumbers[index]}`,
      }));

      importedPlayers.forEach((player) => {
        const candidates = shuffleArray(next.slice(0, selectedCount).map((team, index) => ({ team, index })));
        const target = candidates.reduce((best, candidate) => {
          if (!best) return candidate;
          const candidateGenderCount = candidate.team.players.filter((member) => member.gender === player.gender).length;
          const bestGenderCount = best.team.players.filter((member) => member.gender === player.gender).length;
          if (candidateGenderCount !== bestGenderCount) {
            return candidateGenderCount < bestGenderCount ? candidate : best;
          }
          return candidate.team.players.length < best.team.players.length ? candidate : best;
        }, null as (typeof candidates)[number] | null);
        if (!target) return;
        next[target.index] = { ...next[target.index], players: [...next[target.index].players, player] };
      });

      const playerByName = new Map(
        next.flatMap((team) => team.players)
          .filter((player) => player.name.trim())
          .map((player) => [normalizePersonName(player.name), player] as const),
      );
      const connectedPairs = new Set<string>();
      parsed.players.forEach((draft) => {
        if (!draft.bondKind || !draft.partnerName) return;
        const player = playerByName.get(normalizePersonName(draft.name));
        const partner = playerByName.get(normalizePersonName(draft.partnerName));
        if (!player || !partner || player.id === partner.id) return;
        const pairKey = [player.id, partner.id].sort().join(":");
        if (connectedPairs.has(pairKey)) return;
        connectedPairs.add(pairKey);
        next.forEach((team, teamIndex) => {
          next[teamIndex] = {
            ...team,
            players: team.players.map((candidate) => {
              if (candidate.id === player.id) return withPlayerBond(candidate, partner.id, draft.bondKind!);
              if (candidate.id === partner.id) return withPlayerBond(candidate, player.id, draft.bondKind!);
              return candidate;
            }),
          };
        });
      });

      return sanitizePlayerBonds(next);
    });
    setPlayerImportText("");
    setPlayerImportFeedbackKind("success");
    const feedbackParts = [
      createdPlayerCount > 0 ? `${createdPlayerCount} added` : "",
      updatedPlayerCount > 0 ? `${updatedPlayerCount} updated` : "",
    ].filter(Boolean);
    setPlayerImportFeedback(
      createdPlayerCount > 0
        ? `${feedbackParts.join(" · ")}. New players were gender-balanced across teams.`
        : `${feedbackParts.join(" · ")}. Existing players were updated in place.`,
    );
  };

  const startPlayerDrag = (
    event: DragEvent<HTMLButtonElement>,
    teamId: string,
    playerId: string,
  ) => {
    const row = event.currentTarget.closest(".player-editor-row");
    if (row instanceof HTMLElement) {
      event.dataTransfer.setDragImage(row, 18, Math.min(row.offsetHeight / 2, 24));
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", playerId);
    setDraggedPlayer({ teamId, playerId });
  };

  const movePlayerToTeam = (targetTeamId: string) => {
    if (!draggedPlayer || draggedPlayer.teamId === targetTeamId) {
      setDraggedPlayer(null);
      setDropTeamId(null);
      setDropPlayerId(null);
      return;
    }
    setTeams((previous) => {
      const sourceTeam = previous.find((team) => team.id === draggedPlayer.teamId);
      const player = sourceTeam?.players.find((candidate) => candidate.id === draggedPlayer.playerId);
      if (!player) return previous;
      return previous.map((team) => {
        if (team.id === draggedPlayer.teamId) {
          return { ...team, players: team.players.filter((candidate) => candidate.id !== player.id) };
        }
        if (team.id === targetTeamId) {
          return { ...team, players: [...team.players, player] };
        }
        return team;
      });
    });
    setDraggedPlayer(null);
    setDropTeamId(null);
    setDropPlayerId(null);
  };

  const swapPlayersBetweenTeams = (targetTeamId: string, targetPlayerId: string) => {
    if (!draggedPlayer || draggedPlayer.teamId === targetTeamId || draggedPlayer.playerId === targetPlayerId) {
      setDraggedPlayer(null);
      setDropTeamId(null);
      setDropPlayerId(null);
      return;
    }
    setTeams((previous) => {
      const sourceTeam = previous.find((team) => team.id === draggedPlayer.teamId);
      const targetTeam = previous.find((team) => team.id === targetTeamId);
      const sourcePlayer = sourceTeam?.players.find((player) => player.id === draggedPlayer.playerId);
      const targetPlayer = targetTeam?.players.find((player) => player.id === targetPlayerId);
      if (!sourcePlayer || !targetPlayer) return previous;
      return previous.map((team) => {
        if (team.id === draggedPlayer.teamId) {
          return {
            ...team,
            players: team.players.map((player) => (
              player.id === sourcePlayer.id ? targetPlayer : player
            )),
          };
        }
        if (team.id === targetTeamId) {
          return {
            ...team,
            players: team.players.map((player) => (
              player.id === targetPlayer.id ? sourcePlayer : player
            )),
          };
        }
        return team;
      });
    });
    setDraggedPlayer(null);
    setDropTeamId(null);
    setDropPlayerId(null);
  };

  const addTeam = () => {
    const options = getThemeOptions(settings.themeId);
    setTeams((prev) => {
      const pick = options[prev.length % options.length] ?? options[0];
      const playerNumbers = getAvailableDefaultPlayerNumbers(prev, 3);
      return [
        ...prev,
        {
          id: makeId("team"),
          name: `Team ${prev.length + 1}`,
          score: 0,
          badgeEmoji: pick?.emoji,
          accentBase: pick?.base,
          accentGlow: pick?.glow,
          players: [
            { id: makeId("p"), name: "", placeholder: `Player ${playerNumbers[0]}` },
            { id: makeId("p"), name: "", placeholder: `Player ${playerNumbers[1]}` },
            { id: makeId("p"), name: "", placeholder: `Player ${playerNumbers[2]}` },
          ],
        },
      ];
    });
  };

  const removeTeam = (teamId: string) => {
    setTeams((prev) => sanitizePlayerBonds(prev.filter((team) => team.id !== teamId)));
  };

  const setConnection = () => {
    if (!connectionFromId || !connectionToId || connectionFromId === connectionToId) return;
    setTeams((previous) => previous.map((team) => ({
      ...team,
      players: team.players.map((player) => {
        if (player.id === connectionFromId) {
          return withPlayerBond(player, connectionToId, connectionKind);
        }
        if (player.id === connectionToId) {
          return withPlayerBond(player, connectionFromId, connectionKind);
        }
        return player;
      }),
    })));
    setConnectionFromId("");
    setConnectionToId("");
  };

  const removeConnection = (firstPlayerId: string, secondPlayerId: string) => {
    setTeams((previous) => previous.map((team) => ({
      ...team,
      players: team.players.map((player) => {
        if (player.id === firstPlayerId) return withoutPlayerBond(player, secondPlayerId);
        if (player.id === secondPlayerId) return withoutPlayerBond(player, firstPlayerId);
        return player;
      }),
    })));
  };

  const activeTheme = getThemeById(settings.themeId);
  const emojiOptions = activeTheme.options;
  const connectionPlayers = teams.flatMap((team) => team.players
    .filter((player) => player.name.trim())
    .map((player) => ({
      id: player.id,
      name: player.name.trim(),
      bonds: getPlayerBonds(player),
    })))
    .sort((first, second) => first.name.localeCompare(second.name, "nb", { sensitivity: "base" }));
  const playerById = new Map(connectionPlayers.map((player) => [player.id, player]));
  const connections = connectionPlayers.flatMap((player) => {
    return player.bonds.flatMap((bond) => {
      const kind = normalizePlayerBondKind(bond.kind);
      if (!kind) return [];
      if (player.id > bond.playerId) return [];
      const partner = playerById.get(bond.playerId);
      return partner ? [{ first: player, second: partner, kind }] : [];
    });
  });
  const connectionsOpen = connectionsOpenOverride ?? connections.length > 0;

  return (
    <main className="admin-page teams-page">
      <div
        className="admin-hero"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "16px",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: "260px" }}>
          <h1 style={{ margin: 0 }}>Teams & Players</h1>
          <p style={{ color: "var(--muted)", marginTop: "6px" }}>
            Aim for 3–5 teams. All changes are saved locally.
          </p>
        </div>
        <section className="card player-distributor" aria-labelledby="player-distributor-title">
          <div className="player-distributor-copy">
            <h2 id="player-distributor-title">Quick player distribution</h2>
            <p><code>Name, M/F, relationship, partner</code></p>
          </div>
          <div className="player-distributor-fields">
            <label className="label player-distributor-names">
              Player names
              <textarea
                className="input"
                rows={3}
                value={playerImportText}
                onChange={(event) => {
                  setPlayerImportText(event.target.value);
                  setPlayerImportFeedback("");
                }}
                placeholder={"Alva, F, Married, Brage\nBrage, M, Married, Alva\nMikkel, M"}
              />
              <small className="player-distributor-syntax">
                Relationships: Sweethearts · Engaged · Married · Parents · Drinking buddies
              </small>
              {playerImportFeedback && (
                <small
                  className={`player-distributor-feedback is-${playerImportFeedbackKind}`}
                  role="status"
                >
                  {playerImportFeedback}
                </small>
              )}
            </label>
            <div className="player-distributor-actions">
              <label className="label">
                Number of teams
                <select
                  className="input"
                  value={Math.min(distributionTeamCount, Math.max(teams.length, 1))}
                  onChange={(event) => setDistributionTeamCount(Number(event.target.value))}
                  disabled={teams.length === 0}
                >
                  {teams.map((_, index) => (
                    <option key={index + 1} value={index + 1}>{index + 1}</option>
                  ))}
                </select>
              </label>
              <button
                className="button primary"
                type="button"
                onClick={distributeImportedPlayers}
                disabled={!playerImportText.trim() || teams.length === 0}
              >
                Distribute players
              </button>
            </div>
          </div>
        </section>
      </div>

      <section
        className={`card connections-accordion${connectionsOpen ? " is-open" : ""}`}
        aria-labelledby="connections-title"
      >
        <button
          className="connections-accordion-trigger"
          type="button"
          aria-expanded={connectionsOpen}
          aria-controls="connections-accordion-content"
          onClick={() => setConnectionsOpenOverride(!connectionsOpen)}
        >
          <span className="connections-accordion-heading">
            <strong id="connections-title">Connections</strong>
            <small>Optional podium-only relationships</small>
          </span>
          <span className="connections-accordion-meta">
            <span>{connections.length} {connections.length === 1 ? "relationship" : "relationships"}</span>
            <b>{connectionsOpen ? "Hide connections" : "Show connections"}</b>
          </span>
        </button>
        {connectionsOpen && (
          <div id="connections-accordion-content" className="connections-accordion-content">
            <p>Players can have several connections.</p>
            <div className="connections-accordion-fields">
              <label className="label">
                Player
                <select className="input" value={connectionFromId} onChange={(event) => setConnectionFromId(event.target.value)}>
                  <option value="">Choose player…</option>
                  {connectionPlayers.map((player) => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
              </label>
              <label className="label connections-kind-field">
                Connection
                <select className="input" value={connectionKind} onChange={(event) => setConnectionKind(event.target.value as PlayerBondKind)}>
                  {PLAYER_BOND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.emoji} {option.label}</option>
                  ))}
                </select>
              </label>
              <label className="label">
                With
                <select className="input" value={connectionToId} onChange={(event) => setConnectionToId(event.target.value)}>
                  <option value="">Choose player…</option>
                  {connectionPlayers.filter((player) => player.id !== connectionFromId).map((player) => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
              </label>
              <button
                className="button secondary"
                type="button"
                disabled={!connectionFromId || !connectionToId || connectionFromId === connectionToId}
                onClick={setConnection}
              >
                Connect
              </button>
            </div>
            {connections.length > 0 && (
              <div className="connections-list">
                {connections.map(({ first, second, kind }) => {
                  const option = PLAYER_BOND_OPTIONS.find((candidate) => candidate.value === kind) ?? PLAYER_BOND_OPTIONS[0];
                  return (
                    <span key={`${first.id}-${second.id}`}>
                      <span aria-hidden>{option.emoji}</span>
                      <span>{first.name} + {second.name}</span>
                      <button
                        className="button ghost compact"
                        type="button"
                        aria-label={`Remove connection between ${first.name} and ${second.name}`}
                        title="Remove connection"
                        onClick={() => removeConnection(first.id, second.id)}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="team-editor-toolbar">
        <div>
          <h2>Teams</h2>
          <span>{teams.length} {teams.length === 1 ? "team" : "teams"}</span>
        </div>
        <div className="team-editor-toolbar-actions">
          <div className="shuffle-player-control">
            <label className="shuffle-balance-toggle">
              <input
                type="checkbox"
                checked={balanceGenderMix}
                disabled={isShuffling}
                onChange={(event) => setBalanceGenderMix(event.target.checked)}
              />
              <span>Balance M/F mix when shuffling</span>
            </label>
            <button
              className="button ghost"
              onClick={startShuffling}
              disabled={isShuffling || !teams.some((team) => team.players.some((player) => player.name.trim()))}
              title={teams.some((team) => team.players.some((player) => player.name.trim()))
                ? "Shuffle entered player names across teams"
                : "Enter at least one player name to shuffle"}
              style={{ cursor: "pointer" }}
            >
              {shuffleLabel()}
            </button>
          </div>
          <button className="button primary" onClick={addTeam} style={{ cursor: "pointer" }}>
            + Add team
          </button>
        </div>
      </div>

      <div
        className="team-editor-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        {teams.map((team) => {
          const presentation = getTeamAccent(team);
          const colorBase = presentation.base;
          const teamNameWidth = `${Math.max(9, Math.min(team.name.length + 4, 28))}ch`;
          const longestPlayerLength = team.players.reduce(
            (longest, player) => Math.max(
              longest,
              (player.name || player.placeholder || "").length,
            ),
            0,
          );
          const playerNameWidth = `${Math.max(8, Math.min(longestPlayerLength + 2, 26))}ch`;
          return (
            <div
              key={team.id}
              className={`card team-editor${dropTeamId === team.id && !dropPlayerId && draggedPlayer?.teamId !== team.id ? " is-player-drop-target" : ""}`}
              onDragEnter={(event) => {
                if (!draggedPlayer || draggedPlayer.teamId === team.id) return;
                event.preventDefault();
                setDropTeamId(team.id);
              }}
              onDragOver={(event) => {
                if (!draggedPlayer || draggedPlayer.teamId === team.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                const row = event.target instanceof Element
                  ? event.target.closest(".player-editor-row")
                  : null;
                if (!row) setDropPlayerId(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                movePlayerToTeam(team.id);
              }}
              style={{
                padding: "16px",
                borderColor: "rgba(255,255,255,0.14)",
                position: "relative",
                "--team-accent": presentation.base,
                "--team-card-content-width": `max(176px, calc(${teamNameWidth} + 62px), calc(${playerNameWidth} + 76px))`,
              } as CSSProperties}
            >
              <button
                className="button ghost team-remove"
                onClick={() => removeTeam(team.id)}
                aria-label={`Remove ${team.name}`}
                title={`Remove ${team.name}`}
              >
                ×
              </button>
              <div
                className="team-editor-head"
              >
                <EditableTeamPill
                  name={team.name}
                  color={colorBase}
                  emoji={team.badgeEmoji}
                  choices={emojiOptions}
                  teamLabel={team.name || "this team"}
                  onNameChange={(name) => handleTeamNameChange(team.id, name)}
                  onEmojiChange={(emoji) => {
                    const choice = emojiOptions.find((option) => option.emoji === emoji);
                    setTeams((previous) => previous.map((candidate) => (
                      candidate.id === team.id
                        ? {
                            ...candidate,
                            badgeEmoji: choice?.emoji ?? candidate.badgeEmoji ?? null,
                            accentBase: choice?.base ?? candidate.accentBase ?? null,
                            accentGlow: choice?.glow ?? candidate.accentGlow ?? null,
                          }
                        : candidate
                    )));
                  }}
                />
              </div>

              <div className="player-editor-list" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label className="label">Players</label>
                {team.players.map((player: Player, idx: number) => (
                  <div
                    key={player.id}
                    className={`player-editor-row${draggedPlayer?.playerId === player.id ? " is-dragging" : ""}${dropPlayerId === player.id ? " is-player-swap-target" : ""}`}
                    style={{ display: "flex", gap: "8px", alignItems: "center" }}
                    onDragEnter={(event) => {
                      if (!draggedPlayer || draggedPlayer.teamId === team.id) return;
                      event.preventDefault();
                      event.stopPropagation();
                      setDropTeamId(team.id);
                      setDropPlayerId(player.id);
                    }}
                    onDragOver={(event) => {
                      if (!draggedPlayer || draggedPlayer.teamId === team.id) return;
                      event.preventDefault();
                      event.stopPropagation();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      if (!draggedPlayer || draggedPlayer.teamId === team.id) return;
                      event.preventDefault();
                      event.stopPropagation();
                      swapPlayersBetweenTeams(team.id, player.id);
                    }}
                  >
                    <button
                      className="player-drag-handle"
                      type="button"
                      draggable
                      onDragStart={(event) => startPlayerDrag(event, team.id, player.id)}
                      onDragEnd={() => {
                        setDraggedPlayer(null);
                        setDropTeamId(null);
                        setDropPlayerId(null);
                      }}
                      aria-label={`Move ${player.name || player.placeholder || `Player ${idx + 1}`} to another team`}
                      title="Drag player to another team"
                    >
                      ⠿
                    </button>
                    <input
                      className="input"
                      value={player.name}
                      style={{
                        "--player-name-width": `${Math.max(8, Math.min(player.name.length + 2, 26))}ch`,
                      } as CSSProperties}
                      onChange={(e) =>
                        handlePlayerNameChange(team.id, player.id, e.target.value)
                      }
                      placeholder={player.placeholder || `Player ${idx + 1}`}
                      aria-label={`${player.placeholder || `Player ${idx + 1}`} in ${team.name}`}
                    />
                    <button
                      className="player-remove-button"
                      type="button"
                      onClick={() => removePlayer(team.id, player.id)}
                      aria-label={`Remove ${player.name || player.placeholder || `Player ${idx + 1}`}`}
                      title="Remove player"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="team-card-actions">
                  <button
                    className="button secondary"
                    onClick={() => addPlayer(team.id)}
                    style={{ cursor: "pointer" }}
                  >
                    + Add player
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
