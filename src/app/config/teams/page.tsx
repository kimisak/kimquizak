'use client';

import { useEffect, useState } from "react";
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
  type EmojiOption,
} from "@/lib/defaultData";
import { TeamPill } from "@/components/game/TeamPill";

export default function TeamConfigPage() {
  const [hydrated, setHydrated] = useState(false);
  const [settings] = useSettings();
  const [teams, setTeams] = usePersistentState<Team[]>(
    TEAM_STORAGE_KEY,
    [],
    [LEGACY_TEAM_STORAGE_KEY],
  );
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleMillisLeft, setShuffleMillisLeft] = useState<number | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setHydrated(true);
      if (teams.length === 0) {
        setTeams(buildDefaultTeams(settings.themeId));
      }
    }, 0);
    return () => clearTimeout(id);
  }, [teams.length, setTeams, settings.themeId]);

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
      const counts = prev.map((team) => team.players.length);
      const allPlayers = prev.flatMap((team) => team.players);
      if (allPlayers.length === 0) return prev;
      const shuffled = shuffleArray(allPlayers);
      let cursor = 0;
      return prev.map((team, idx) => {
        const take = counts[idx];
        const nextPlayers = shuffled.slice(cursor, cursor + take);
        cursor += take;
        return { ...team, players: nextPlayers };
      });
    });
  };

  const startShuffling = () => {
    if (isShuffling) return;
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

  if (!hydrated) {
    return (
      <main className="card" style={{ padding: "24px" }}>
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
    setTeams((prev) =>
      prev.map((team) =>
        team.id === teamId
          ? {
              ...team,
              players: [
                ...team.players,
                { id: makeId("p"), name: `Player ${team.players.length + 1}` },
              ],
            }
          : team,
      ),
    );
  };

  const removePlayer = (teamId: string, playerId: string) => {
    setTeams((prev) =>
      prev.map((team) =>
        team.id === teamId
          ? {
              ...team,
              players: team.players.filter((p) => p.id !== playerId),
            }
          : team,
      ),
    );
  };

  const addTeam = () => {
    const options = getThemeOptions(settings.themeId);
    const pick = options[teams.length % options.length] ?? options[0];
    setTeams((prev) => [
      ...prev,
      {
        id: makeId("team"),
        name: `Team ${prev.length + 1}`,
        score: 0,
        badgeEmoji: pick?.emoji,
        accentBase: pick?.base,
        accentGlow: pick?.glow,
        players: [
          { id: makeId("p"), name: "Player 1" },
          { id: makeId("p"), name: "Player 2" },
          { id: makeId("p"), name: "Player 3" },
        ],
      },
    ]);
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
    <main className="card" style={{ padding: "24px" }}>
      <div
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
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginLeft: "auto", justifyContent: "flex-end" }}>
          <button
            className="button ghost"
            onClick={startShuffling}
            disabled={isShuffling}
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
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        {teams.map((team) => {
          const colorBase = team.accentBase ?? "#f2c14f";
          const colorGlow = team.accentGlow ?? "#ffe29f";
          return (
            <div
              key={team.id}
              className="card"
              style={{ padding: "16px", borderColor: "rgba(255,255,255,0.14)", position: "relative" }}
            >
              <button
                className="button ghost"
                onClick={() => removeTeam(team.id)}
                style={{
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                  width: "28px",
                  height: "28px",
                  borderRadius: "999px",
                  display: "grid",
                  placeItems: "center",
                  padding: 0,
                  lineHeight: 1,
                  cursor: "pointer",
                }}
                aria-label={`Remove ${team.name}`}
              >
                ✕
              </button>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: "10px",
                  marginBottom: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: "180px" }}>
                  <label className="label">Team name</label>
                  <input
                    className="input"
                    value={team.name}
                    onChange={(e) => handleTeamNameChange(team.id, e.target.value)}
                    placeholder="Team name"
                  />
                </div>
                <div style={{ minWidth: "140px", position: "relative" }}>
                  <label className="label">Emoji</label>
                  <select
                    className="input"
                    value={team.badgeEmoji ?? ""}
                    style={{ paddingRight: "26px", cursor: "pointer" }}
                    onChange={(e) => {
                      const choice = emojiOptions.find((opt) => opt.emoji === e.target.value);
                      setTeams((prev) =>
                        prev.map((t) =>
                          t.id === team.id
                            ? {
                                ...t,
                                badgeEmoji: choice?.emoji ?? null,
                                accentBase: choice?.base ?? t.accentBase ?? null,
                                accentGlow: choice?.glow ?? t.accentGlow ?? null,
                              }
                            : t,
                        ),
                      );
                    }}
                  >
                    {emojiOptions.map((opt) => (
                      <option key={opt.emoji} value={opt.emoji}>
                        {opt.emoji} {opt.label}
                      </option>
                    ))}
                  </select>
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      right: "10px",
                      bottom: "10px",
                      pointerEvents: "none",
                      color: "var(--muted)",
                      fontSize: "0.9rem",
                    }}
                  >
                    ▼
                  </span>
                </div>
                <div style={{ minWidth: "320px", flex: 1 }}>
                  <label className="label">Preview</label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      aria-label="Team colors"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        title={`Base ${colorBase}`}
                        style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "6px",
                          background: colorBase,
                          border: "1px solid rgba(255,255,255,0.22)",
                          boxShadow: `0 0 0 2px ${colorBase}33`,
                        }}
                      />
                      <span
                        title={`Glow ${colorGlow}`}
                        style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "6px",
                          background: colorGlow,
                          border: "1px solid rgba(255,255,255,0.14)",
                          boxShadow: `0 0 0 2px ${colorGlow}22`,
                        }}
                      />
                      <span
                        title="Accent gradient"
                        style={{
                          width: "46px",
                          height: "22px",
                          borderRadius: "999px",
                          background: `linear-gradient(135deg, ${colorBase}, ${colorGlow})`,
                          border: "1px solid rgba(255,255,255,0.18)",
                          boxShadow: `0 2px 6px ${colorBase}3d`,
                        }}
                      />
                    </div>
                    <TeamPill
                      name={team.name || "Team"}
                      color={colorBase}
                      emoji={team.badgeEmoji ?? "⭐️"}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label className="label">Players</label>
                {team.players.map((player: Player, idx: number) => (
                  <div
                    key={player.id}
                    style={{ display: "flex", gap: "8px", alignItems: "center" }}
                  >
                    <input
                      className="input"
                      value={player.name}
                      onChange={(e) =>
                        handlePlayerNameChange(team.id, player.id, e.target.value)
                      }
                      placeholder={`Player ${idx + 1}`}
                    />
                    <button
                      className="button ghost"
                      onClick={() => removePlayer(team.id, player.id)}
                      style={{ paddingInline: "10px", cursor: "pointer" }}
                      aria-label={`Remove ${player.name}`}
                    >
                      –
                    </button>
                  </div>
                ))}
                <button
                  className="button secondary"
                  onClick={() => addPlayer(team.id)}
                  style={{ width: "fit-content", cursor: "pointer" }}
                >
                  + Add player
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
