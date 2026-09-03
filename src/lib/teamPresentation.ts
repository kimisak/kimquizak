import type { Team } from "@/lib/types";
import { getThemeOptions, teamThemes } from "@/lib/defaultData";

const FALLBACK_ACCENTS = [
  { base: "#b9001f", glow: "#f7c948" },
  { base: "#0b8a3b", glow: "#d1fae5" },
  { base: "#b03060", glow: "#ffd6e0" },
  { base: "#8a3b12", glow: "#f6e05e" },
  { base: "#0f4c75", glow: "#b0e0ff" },
];

const FALLBACK_MARKERS = ["🎄", "⭐️", "🔔", "❄️", "🎁"];

const LEGACY_ACCENT_UPDATES: Record<string, { from: string | string[]; base: string; glow: string }> = {
  "🧠": { from: "#f8fafc", base: "#64748b", glow: "#e2e8f0" },
  "🐚": { from: ["#f59e0b", "#b7791f"], base: "#9a6818", glow: "#fde68a" },
  "🏖️": { from: ["#f97316", "#d95f0e"], base: "#e35d0a", glow: "#fed7aa" },
  "🎁": { from: ["#b9001f", "#9f1732"], base: "#8f1230", glow: "#f7c948" },
  "🔔": { from: ["#b03060", "#8d3a68"], base: "#9a6818", glow: "#f2cf78" },
  "❄️": { from: ["#0f4c75", "#2f6f98", "#24527a"], base: "#28afe3", glow: "#c9f2ff" },
  "⭐️": { from: ["#b8860b", "#9a7600", "#806000", "#e0b600"], base: "#ffd84d", glow: "#fff7c2" },
  "🕯️": { from: ["#f4a259", "#d46a2d", "#e36f25"], base: "#7c3aed", glow: "#ddd6fe" },
  "🎅": { from: ["#d62828", "#dc4b32", "#e0522d"], base: "#c6283d", glow: "#fecdd3" },
  "☃️": { from: ["#4ba3c7", "#58a9c4", "#55b8d1"], base: "#d97706", glow: "#fff7ed" },
};

const DARK_EMOJI_SURFACE = new Set(["🧠", "🐚", "⚡️", "💿", "❄️", "⭐️", "🕯️"]);

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return [201, 156, 74] as const;
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16)) as [number, number, number];
}

function rgbToHex(rgb: readonly number[]) {
  return `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function mixColors(color: string, toward: string, amount: number) {
  const source = hexToRgb(color);
  const target = hexToRgb(toward);
  return rgbToHex(source.map((value, index) => value * (1 - amount) + target[index] * amount));
}

function luminance(color: string) {
  return hexToRgb(color)
    .map((value) => value / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(colorA: string, colorB: string) {
  const lighter = Math.max(luminance(colorA), luminance(colorB));
  const darker = Math.min(luminance(colorA), luminance(colorB));
  return (lighter + 0.05) / (darker + 0.05);
}

function ensureContrast(color: string, surface: string, toward: string, minimum = 3) {
  if (contrast(color, surface) >= minimum) return color;
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mixColors(color, toward, step / 20);
    if (contrast(candidate, surface) >= minimum) return candidate;
  }
  return toward;
}

function pickIndex(id: string, modulo: number) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % modulo;
}

export function getTeamAccent(team: Team) {
  const fallback = FALLBACK_ACCENTS[pickIndex(team.id, FALLBACK_ACCENTS.length)];
  const marker = getTeamMarker(team);
  const update = LEGACY_ACCENT_UPDATES[marker];
  const legacyColors = update ? (Array.isArray(update.from) ? update.from : [update.from]) : [];
  const shouldUpdate = update && legacyColors.includes(team.accentBase?.toLowerCase() ?? "");
  const base = shouldUpdate ? update.base : team.accentBase || fallback.base;
  const glow = shouldUpdate ? update.glow : team.accentGlow || fallback.glow;

  return {
    base,
    glow,
    onLight: ensureContrast(base, "#fff8e8", "#2d211b"),
    onDark: ensureContrast(base, "#18261f", "#fff8e8"),
    tint: mixColors(base, "#fff8e8", 0.84),
    emojiSurface: getEmojiSurface(marker),
  };
}

export function getEmojiSurface(marker?: string | null) {
  return DARK_EMOJI_SURFACE.has(marker ?? "") ? "dark" as const : "light" as const;
}

export function getTeamMarker(team: Team) {
  return team.badgeEmoji ?? FALLBACK_MARKERS[pickIndex(team.id, FALLBACK_MARKERS.length)];
}

/**
 * Move teams that still use one of the built-in presets to the equivalent
 * option in the selected theme. Imported/custom colors are intentionally left
 * alone, even when they happen to use a familiar emoji.
 */
export function reconcileTeamTheme(team: Team, themeId?: string): Team {
  const marker = getTeamMarker(team);
  const source = teamThemes
    .map((theme) => ({ theme, optionIndex: theme.options.findIndex((option) => option.emoji === marker) }))
    .find(({ optionIndex }) => optionIndex >= 0);

  if (!source) return team;

  const sourceOption = source.theme.options[source.optionIndex];
  const presented = getTeamAccent(team);
  const usesBuiltInPreset = presented.base.toLowerCase() === sourceOption.base.toLowerCase();
  if (!usesBuiltInPreset) return team;

  const targetOptions = getThemeOptions(themeId);
  const target = targetOptions[source.optionIndex % targetOptions.length];
  if (!target) return team;

  if (
    team.badgeEmoji === target.emoji
    && team.accentBase?.toLowerCase() === target.base.toLowerCase()
    && team.accentGlow?.toLowerCase() === target.glow.toLowerCase()
  ) {
    return team;
  }

  return {
    ...team,
    badgeEmoji: target.emoji,
    accentBase: target.base,
    accentGlow: target.glow,
  };
}
