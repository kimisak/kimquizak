// Match both marker and preset color so other themes/custom emojis stay intact.
const animals: Record<string, { color: string; file: string }> = {
  "🐐": { color: "#004c61", file: "goat" },
  "🦊": { color: "#4a11b7", file: "fox" },
  "🦦": { color: "#00ca97", file: "otter" },
  "🦉": { color: "#bb5ce9", file: "owl" },
  "🐰": { color: "#86ffd9", file: "rabbit" },
  "🦋": { color: "#ffa2ff", file: "butterfly" },
  "🦌": { color: "#0c1c35", file: "deer" },
  "🐙": { color: "#220038", file: "octopus" },
};

export function getTeamAnimalSrc(emoji?: string | null, color?: string) {
  const animal = emoji ? animals[emoji] : undefined;
  return animal && color?.toLowerCase() === animal.color
    ? `/team-animals/${animal.file}.svg`
    : undefined;
}
