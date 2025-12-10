'use client';

import { useEffect, useState } from "react";
import type { Team } from "@/lib/types";

type Props = {
  teams: Team[];
  onAdjust: (teamId: string, delta: number) => void;
  onSet: (teamId: string, value: number) => void;
};

export function Leaderboard({ teams, onAdjust, onSet }: Props) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth <= 768);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const accents = [
    { base: "#b9001f", glow: "#f7c948" }, // deep red + gold
    { base: "#0b8a3b", glow: "#d1fae5" }, // evergreen + mint
    { base: "#b03060", glow: "#ffd6e0" }, // mulled wine
    { base: "#8a3b12", glow: "#f6e05e" }, // gingerbread
    { base: "#0f4c75", glow: "#b0e0ff" }, // winter blue
  ];
  const markers = ["🎄", "⭐️", "🔔", "❄️", "🎁"];

  const pickIndex = (id: string, modulo: number) => {
    let hash = 0;
    for (let i = 0; i < id.length; i += 1) {
      hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % modulo;
  };

  return (
    <section className="card" style={{ padding: "18px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
          gap: "10px",
        }}
      >
        <h2 style={{ margin: 0 }}>Leaderboard</h2>
        <span style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
          Click + / - or type a correction to fix scores.
        </span>
      </div>
      {teams.length === 0 ? (
        <div style={{ color: "var(--muted)" }}>
          Add teams first in the Teams page.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "10px", overflowX: isMobile ? "auto" : "visible", paddingBottom: isMobile ? "4px" : undefined }}>
          {teams.map((team, idx) => {
            const accent =
              team.accentBase && team.accentGlow
                ? { base: team.accentBase, glow: team.accentGlow }
                : accents[pickIndex(team.id, accents.length)];
            const marker =
              team.badgeEmoji ||
              markers[pickIndex(team.id, markers.length)];

            return (
              <div
                key={team.id}
                className="card"
                style={{
                  padding: "12px",
                  display: "flex",
                  alignItems: isMobile ? "flex-start" : "center",
                  gap: "12px",
                  flexWrap: isMobile ? "wrap" : "nowrap",
                  borderColor: `${accent.base}40`,
                  background: "rgba(255,255,255,0.03)",
                  borderLeft: `4px solid ${accent.base}`,
                  boxShadow: `0 4px 14px ${accent.base}30`,
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "12px",
                    background: `${accent.base}`,
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    color: "#f8fafc",
                    border: `1px solid ${accent.glow}55`,
                    boxShadow: `0 3px 10px ${accent.base}45`,
                  }}
              >
                #{idx + 1}
              </div>
              <div style={{ display: "grid", gap: "6px", minWidth: "180px", flex: 1 }}>
                <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 10px",
                        borderRadius: "999px",
                        background: `${accent.base}22`,
                        border: `2px solid ${accent.base}55`,
                        color: "#f8fafc",
                        fontWeight: 900,
                        letterSpacing: "0.01em",
                        boxShadow: `0 1px 6px ${accent.base}44`,
                      }}
                    >
                      <span>{marker}</span>
                      <span style={{ textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>{team.name}</span>
                    </span>
                  </div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.95rem",
                      display: "flex",
                      gap: "6px",
                      flexWrap: "wrap",
                    }}
                  >
                    {team.players.map((p) => p.name).join(", ")}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontWeight: 800,
                    minWidth: isMobile ? "100%" : "170px",
                    marginLeft: isMobile ? 0 : "auto",
                    flexWrap: isMobile ? "wrap" : "nowrap",
                    justifyContent: isMobile ? "space-between" : "flex-end",
                  }}
                >
                  <button
                    className="button ghost"
                    onClick={() => onAdjust(team.id, -100)}
                    style={{ paddingInline: "12px", cursor: "pointer" }}
                  >
                    -100
                  </button>
                  <input
                    type="number"
                    value={team.score}
                    onChange={(e) => onSet(team.id, Number(e.target.value))}
                    style={{
                      width: "90px",
                      textAlign: "center",
                      padding: "8px 10px",
                      borderRadius: "10px",
                      border: `1px solid ${accent.base}55`,
                      background: "rgba(255,255,255,0.07)",
                      color: "var(--foreground)",
                    }}
                  />
                  <button
                    className="button ghost"
                    onClick={() => onAdjust(team.id, 100)}
                    style={{ paddingInline: "12px", cursor: "pointer" }}
                  >
                    +100
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
