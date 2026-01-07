'use client';

import { StorageBackupPanel } from "@/components/StorageBackupPanel";
import { useSettings } from "@/hooks/useSettings";
import { usePersistentState } from "@/hooks/usePersistentState";
import {
  getThemeById,
  getThemeOptions,
  teamThemes,
  type EmojiOption,
} from "@/lib/defaultData";
import {
  LEGACY_TEAM_STORAGE_KEY,
  TEAM_STORAGE_KEY,
} from "@/lib/storage";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { Team } from "@/lib/types";
import { TeamPill } from "@/components/game/TeamPill";

export default function Home() {
  const [settings, setSettings] = useSettings();
  const [teams, setTeams] = usePersistentState<Team[]>(
    TEAM_STORAGE_KEY,
    [],
    [LEGACY_TEAM_STORAGE_KEY],
  );

  const activeTheme = getThemeById(settings.themeId);
  const emojiOptions = activeTheme.options;
  const themePreview =
    emojiOptions[0] ?? { emoji: "⭐️", label: "Star", base: "#3b82f6", glow: "#93c5fd" };
  const toRgba = (hex: string, alpha: number) => {
    const clean = hex.replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const num = Number.parseInt(full, 16);
    if (Number.isNaN(num)) return `rgba(59,130,246,${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  const themeGradient =
    emojiOptions.length > 1
      ? `linear-gradient(120deg, ${emojiOptions[0].base}, ${emojiOptions[1].base})`
      : `linear-gradient(120deg, ${themePreview.base}, ${themePreview.glow})`;
  const themeHeaderGradient =
    emojiOptions.length > 1
      ? `linear-gradient(135deg, ${toRgba(emojiOptions[0].base, 0.55)}, ${toRgba(emojiOptions[1].base, 0.55)})`
      : `linear-gradient(135deg, ${toRgba(themePreview.base, 0.55)}, ${toRgba(themePreview.glow, 0.55)})`;

  const applyThemeToTeams = (themeId: string) => {
    const options = getThemeOptions(themeId);
    setTeams((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((team, idx) => {
        const match =
          team.badgeEmoji &&
          options.find((opt) => opt.emoji === team.badgeEmoji);
        const pick = match ?? options[idx % options.length] ?? options[0];
        return {
          ...team,
          badgeEmoji: pick?.emoji ?? team.badgeEmoji,
          accentBase: pick?.base ?? team.accentBase,
          accentGlow: pick?.glow ?? team.accentGlow,
        };
      });
    });
  };

  return (
    <main
      className="card"
      style={{
        padding: "32px",
      }}
    >
      <h1 style={{ fontSize: "2.4rem", marginBottom: "10px" }}>
        {settings.quizTitle || DEFAULT_SETTINGS.quizTitle}
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "20px" }}>
        Configure teams, enter categories and clues, then run the board from one
        screen. All data stays in your browser (localStorage).
      </p>
      <div
        className="card"
        style={{
          padding: "18px",
          marginBottom: "20px",
          borderColor: "rgba(255,255,255,0.12)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
            alignItems: "start",
          }}
        >
          <div>
            <label className="label">Quiz title</label>
            <input
              className="input"
              value={settings.quizTitle}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  quizTitle: e.target.value,
                }))
              }
              placeholder={DEFAULT_SETTINGS.quizTitle}
            />
            <p style={{ color: "var(--muted)", marginTop: "6px", fontSize: "0.9rem" }}>
              This headline appears on the home screen and the board.
            </p>
          </div>
          <div>
            <label className="label">Team theme</label>
            <div style={{ position: "relative" }}>
              <select
                className="input"
                value={settings.themeId}
                style={{
                  paddingRight: "34px",
                  cursor: "pointer",
                  background: themeHeaderGradient,
                  borderColor: "rgba(255,255,255,0.18)",
                }}
                onChange={(e) => {
                  const nextTheme = e.target.value;
                  setSettings((prev) => ({ ...prev, themeId: nextTheme }));
                  applyThemeToTeams(nextTheme);
                }}
              >
                {teamThemes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.label}
                  </option>
                ))}
              </select>
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--muted)",
                  fontSize: "0.9rem",
                  pointerEvents: "none",
                }}
              >
                ▼
              </span>
            </div>
            <div
              style={{
                marginTop: "10px",
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              {emojiOptions.map((opt: EmojiOption) => (
                <TeamPill
                  key={opt.emoji}
                  name={opt.label}
                  color={opt.base}
                  emoji={opt.emoji}
                />
              ))}
            </div>
            <p style={{ color: "var(--muted)", marginTop: "6px", fontSize: "0.9rem" }}>
              {activeTheme.description}
            </p>
          </div>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gap: "16px",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        <div className="card" style={{ padding: "16px 18px" }}>
          <div style={{ fontWeight: 700, marginBottom: "6px" }}>1) Teams</div>
          <p style={{ color: "var(--muted)", margin: "0 0 12px" }}>
            Create 3–5 teams, name them, and list the players.
          </p>
          <a className="button secondary" href="/config/teams">
            Open team config
          </a>
        </div>
        <div className="card" style={{ padding: "16px 18px" }}>
          <div style={{ fontWeight: 700, marginBottom: "6px" }}>
            2) Categories & clues
          </div>
          <p style={{ color: "var(--muted)", margin: "0 0 12px" }}>
            Enter questions and answers for 100–500 points for each category.
          </p>
          <a className="button secondary" href="/config/questions">
            Open question config
          </a>
        </div>
        <div className="card" style={{ padding: "16px 18px" }}>
          <div style={{ fontWeight: 700, marginBottom: "6px" }}>3) Play</div>
          <p style={{ color: "var(--muted)", margin: "0 0 12px" }}>
            Run the game board, show the modal, and score teams live.
          </p>
          <a className="button primary" href="/game">
            Go to board
          </a>
        </div>
      </div>
      <div className="card" style={{ padding: "16px 18px", marginTop: "16px" }}>
        <StorageBackupPanel />
      </div>
    </main>
  );
}
