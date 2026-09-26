import type { Team } from "./types";

export function ordinalPlace(rank: number): string {
  const lastTwo = rank % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[rank % 10] ?? "th");
  return `${rank}${suffix}`;
}

/** Equal scores share a competition rank and always reveal in the same step. */
export function getFinaleRevealPlan(teams: readonly Team[]) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const tiers: Array<{ rank: number; score: number; teamIds: string[] }> = [];
  sorted.forEach((team, index) => {
    const last = tiers[tiers.length - 1];
    if (last && last.score === team.score) last.teamIds.push(team.id);
    else tiers.push({ rank: index + 1, score: team.score, teamIds: [team.id] });
  });
  const steps = [...tiers].reverse().map(tier => ({
    teamIds: tier.teamIds, ranks: [tier.rank], final: tier.rank === 1,
    label: `Reveal ${ordinalPlace(tier.rank)} place`,
  }));
  return { tiers, steps };
}
