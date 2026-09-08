'use client';

import { useEffect, useState, type CSSProperties } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useSettings } from "@/hooks/useSettings";
import {
  LEGACY_TEAM_STORAGE_KEY,
  LEGACY_TURN_STATE_STORAGE_KEY,
  TEAM_STORAGE_KEY,
  TURN_STATE_STORAGE_KEY,
} from "@/lib/storage";
import type { Player, Team } from "@/lib/types";
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

export default function TeamConfigPage() {
  const [settings] = useSettings();
  const [teams, setTeams, teamsHydrated] = usePersistentState<Team[]>(
    TEAM_STORAGE_KEY,
    [],
    [LEGACY_TEAM_STORAGE_KEY],
  );
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleMillisLeft, setShuffleMillisLeft] = useState<number | null>(null);

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
      return changed ? reconciled : previous;
    });
  }, [teamsHydrated, settings.themeId, setTeams, teams.length]);

  const shuffleArray = <T,>(arr: T[]) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const shufflePlayersAcrossTeams = () => {
    setTeams((prev) => {
      const allNames = prev.flatMap((team) => team.players.map((player) => player.name));
      if (!allNames.some((name) => name.trim())) return prev;
      const shuffledNames = shuffleArray(allNames);
      let cursor = 0;
      return prev.map((team) => ({
        ...team,
        players: team.players.map((player) => ({
          ...player,
          name: shuffledNames[cursor++],
        })),
      }));
    });
  };

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
      prev.map((team) => {
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
      }),
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
    setTeams((prev) => prev.filter((team) => team.id !== teamId));
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
