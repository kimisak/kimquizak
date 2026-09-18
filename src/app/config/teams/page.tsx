'use client';

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useSettings } from "@/hooks/useSettings";
import {
  LEGACY_TEAM_STORAGE_KEY,
  LEGACY_TURN_STATE_STORAGE_KEY,
  TEAM_STORAGE_KEY,
  TURN_STATE_STORAGE_KEY,
} from "@/lib/storage";
import type { Player, PlayerBondKind, Team } from "@/lib/types";
import {
  buildDefaultTeams,
  getThemeById,
  getThemeOptions,
  makeId,
} from "@/lib/defaultData";
import { EditableTeamPill } from "@/components/game/TeamPill";
import { getTeamAccent, reconcileTeamTheme } from "@/lib/teamPresentation";

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

const BOND_OPTIONS: Array<{ value: PlayerBondKind; label: string; emoji: string }> = [
  { value: "besties", label: "Besties", emoji: "🤝" },
  { value: "sweethearts", label: "Sweethearts", emoji: "💞" },
  { value: "rivals", label: "Rivals", emoji: "⚡" },
];

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
      const validBonds = declaredBonds.filter((bond) => {
        const partner = players.get(bond.playerId);
        const reciprocal = partner && getPlayerBonds(partner).some((candidate) => (
          candidate.playerId === player.id && candidate.kind === bond.kind
        ));
        if (!partner || partner.id === player.id || !reciprocal || seenPartners.has(partner.id)) {
          return false;
        }
        seenPartners.add(partner.id);
        return true;
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
  const [connectionFromId, setConnectionFromId] = useState("");
  const [connectionToId, setConnectionToId] = useState("");
  const [connectionKind, setConnectionKind] = useState<PlayerBondKind>("besties");

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
      const shuffledPlayers = shuffleArray(allPlayers);
      let cursor = 0;
      return prev.map((team) => ({
        ...team,
        players: team.players.map((slot) => {
          const player = shuffledPlayers[cursor++];
          return {
            ...player,
            placeholder: slot.placeholder,
          };
        }),
      }));
    });
  }, [setTeams]);

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

  const resetTurnOrder = () => {
    try {
      window.localStorage.removeItem(TURN_STATE_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_TURN_STATE_STORAGE_KEY);
    } catch (err) {
      console.error("Failed clearing turn order", err);
    }
  };

  const activeTheme = getThemeById(settings.themeId);
  const emojiOptions = activeTheme.options;
  const connectionPlayers = teams.flatMap((team) => team.players
    .filter((player) => player.name.trim())
    .map((player) => ({
      id: player.id,
      name: player.name.trim(),
      teamName: team.name,
      bonds: getPlayerBonds(player),
    })));
  const playerById = new Map(connectionPlayers.map((player) => [player.id, player]));
  const connections = connectionPlayers.flatMap((player) => {
    return player.bonds.flatMap((bond) => {
      if (player.id > bond.playerId) return [];
      const partner = playerById.get(bond.playerId);
      return partner ? [{ first: player, second: partner, kind: bond.kind }] : [];
    });
  });

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
        <div className="admin-actions" style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginLeft: "auto", justifyContent: "flex-end" }}>
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
          <button className="button ghost" onClick={resetTurnOrder} title="Clears board turn order so you must spin again on the board" style={{ cursor: "pointer" }}>
            Reset turn order
          </button>
          <button className="button primary" onClick={addTeam} style={{ cursor: "pointer" }}>
            + Add team
          </button>
        </div>
      </div>

      <section
        className="card"
        aria-labelledby="connections-title"
        style={{
          display: "grid",
          gap: "12px",
          marginBottom: "16px",
          padding: "14px 16px",
        }}
      >
        <div>
          <h2 id="connections-title" style={{ margin: 0, fontSize: "1rem" }}>Connections</h2>
          <p style={{ margin: "3px 0 0", color: "var(--muted)", fontSize: ".82rem" }}>
            Optional podium-only relationships. Players can have several connections.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "end", gap: "8px", flexWrap: "wrap" }}>
          <label className="label" style={{ display: "grid", gap: "4px", minWidth: "170px", flex: "1 1 190px" }}>
            Player
            <select className="input" value={connectionFromId} onChange={(event) => setConnectionFromId(event.target.value)}>
              <option value="">Choose player…</option>
              {connectionPlayers.map((player) => (
                <option key={player.id} value={player.id}>{player.name} · {player.teamName}</option>
              ))}
            </select>
          </label>
          <label className="label" style={{ display: "grid", gap: "4px", minWidth: "145px", flex: "0 1 170px" }}>
            Connection
            <select className="input" value={connectionKind} onChange={(event) => setConnectionKind(event.target.value as PlayerBondKind)}>
              {BOND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.emoji} {option.label}</option>
              ))}
            </select>
          </label>
          <label className="label" style={{ display: "grid", gap: "4px", minWidth: "170px", flex: "1 1 190px" }}>
            With
            <select className="input" value={connectionToId} onChange={(event) => setConnectionToId(event.target.value)}>
              <option value="">Choose player…</option>
              {connectionPlayers.filter((player) => player.id !== connectionFromId).map((player) => (
                <option key={player.id} value={player.id}>{player.name} · {player.teamName}</option>
              ))}
            </select>
          </label>
          <button
            className="button secondary"
            type="button"
            disabled={!connectionFromId || !connectionToId || connectionFromId === connectionToId}
            onClick={setConnection}
            style={{ minHeight: "40px" }}
          >
            Connect
          </button>
        </div>
        {connections.length > 0 && (
          <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
            {connections.map(({ first, second, kind }) => {
              const option = BOND_OPTIONS.find((candidate) => candidate.value === kind) ?? BOND_OPTIONS[0];
              return (
                <span
                  key={`${first.id}-${second.id}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 6px 5px 10px",
                    border: "1px solid rgba(74,48,37,.2)",
                    borderRadius: "999px",
                    background: "rgba(255,253,245,.68)",
                    fontSize: ".78rem",
                    fontWeight: 800,
                  }}
                >
                  <span aria-hidden>{option.emoji}</span>
                  {first.name} + {second.name}
                  <button
                    className="button ghost compact"
                    type="button"
                    aria-label={`Remove connection between ${first.name} and ${second.name}`}
                    title="Remove connection"
                    onClick={() => removeConnection(first.id, second.id)}
                    style={{ minWidth: "25px", padding: "2px 6px", borderRadius: "999px" }}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </section>

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
              className="card team-editor"
              style={{
                padding: "16px",
                borderColor: "rgba(255,255,255,0.14)",
                position: "relative",
                "--team-accent": presentation.base,
                "--team-card-content-width": `max(160px, calc(${teamNameWidth} + 62px), calc(${playerNameWidth} + 52px))`,
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
                    className="player-editor-row"
                    style={{ display: "flex", gap: "8px", alignItems: "center" }}
                  >
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
                      className="button ghost"
                      onClick={() => removePlayer(team.id, player.id)}
                      style={{ paddingInline: "10px", cursor: "pointer" }}
                      aria-label={`Remove ${player.name || player.placeholder || `Player ${idx + 1}`}`}
                    >
                      –
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
