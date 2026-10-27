import { normalizePlayerBondKind } from "@/lib/playerBonds";
import type { HostProfile, PlayerBondKind } from "@/lib/types";

export const HOST_PROFILE_ID = "kimquizak-host";
export const HOST_HOME_ID = "kimquizak-host-booth";

export const HOST_EMOJI_OPTIONS = ["🎤", "🎙️", "🎩", "👑", "🪩", "🎭", "🦉", "🧑‍🏫"] as const;

export const DEFAULT_HOST_PROFILE: HostProfile = {
  id: HOST_PROFILE_ID,
  name: "",
  emoji: HOST_EMOJI_OPTIONS[0],
};

export function normalizeHostProfile(value: unknown, validPlayerIds?: ReadonlySet<string>): HostProfile {
  const candidate = value && typeof value === "object"
    ? value as Partial<HostProfile>
    : {};
  const seen = new Set<string>();
  const bonds = Array.isArray(candidate.bonds)
    ? candidate.bonds.flatMap((bond) => {
        const playerId = typeof bond?.playerId === "string" ? bond.playerId : "";
        const kind = normalizePlayerBondKind(bond?.kind);
        if (!playerId || !kind || seen.has(playerId) || (validPlayerIds && !validPlayerIds.has(playerId))) {
          return [];
        }
        seen.add(playerId);
        return [{ playerId, kind }];
      })
    : [];

  return {
    id: HOST_PROFILE_ID,
    name: typeof candidate.name === "string" ? candidate.name : "",
    emoji: typeof candidate.emoji === "string" && candidate.emoji.trim()
      ? candidate.emoji
      : DEFAULT_HOST_PROFILE.emoji,
    bonds: bonds.length ? bonds : undefined,
  };
}

export function withHostBond(profile: HostProfile, playerId: string, kind: PlayerBondKind): HostProfile {
  return normalizeHostProfile({
    ...profile,
    bonds: [
      ...(profile.bonds ?? []).filter((bond) => bond.playerId !== playerId),
      { playerId, kind },
    ],
  });
}

export function withoutHostBond(profile: HostProfile, playerId: string): HostProfile {
  return normalizeHostProfile({
    ...profile,
    bonds: (profile.bonds ?? []).filter((bond) => bond.playerId !== playerId),
  });
}
