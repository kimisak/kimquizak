import type { PlayerBondKind } from "@/lib/types";

export const PLAYER_BOND_OPTIONS: Array<{ value: PlayerBondKind; label: string; emoji: string }> = [
  { value: "sweethearts", label: "Sweethearts", emoji: "💞" },
  { value: "engaged", label: "Engaged", emoji: "💍" },
  { value: "married", label: "Married", emoji: "💒" },
  { value: "parents", label: "Parents", emoji: "🍼" },
  { value: "drinking-buddies", label: "Drinking buddies", emoji: "🍻" },
];

export function normalizePlayerBondKind(value: unknown): PlayerBondKind | null {
  if (value === "besties") return "drinking-buddies";
  if (value === "rivals") return null;
  return PLAYER_BOND_OPTIONS.some((option) => option.value === value)
    ? value as PlayerBondKind
    : null;
}
