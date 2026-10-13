import { type PointValue, type Question, type Team } from "@/lib/types";

export function makeId(prefix: string) {
  return `${prefix}-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2))}`;
}

export type EmojiOption = {
  emoji: string;
  label: string;
  base: string;
  glow: string;
};

export type TeamTheme = {
  id: string;
  label: string;
  description: string;
  options: EmojiOption[];
};

export const teamThemes: TeamTheme[] = [
  {
    id: "capra-liflig",
    label: "Capra × Liflig",
    description: "Eight Noto animals in Capra mint and Liflig violet, led by the Capra goat.",
    // https://capragruppen.anti.guide/toolbox-2/colours
    // Base and glow pairs use only the official Capra and Liflig palettes.
    options: [
      { emoji: "🐐", label: "Goat", base: "#004c61", glow: "#defcf5" },
      { emoji: "🦊", label: "Fox", base: "#4a11b7", glow: "#ffe8fe" },
      { emoji: "🦦", label: "Otter", base: "#00ca97", glow: "#86ffd9" },
      { emoji: "🦉", label: "Owl", base: "#bb5ce9", glow: "#ffa2ff" },
      { emoji: "🐰", label: "Rabbit", base: "#86ffd9", glow: "#defcf5" },
      { emoji: "🦋", label: "Butterfly", base: "#ffa2ff", glow: "#ffe8fe" },
      { emoji: "🦌", label: "Deer", base: "#0c1c35", glow: "#86ffd9" },
      { emoji: "🐙", label: "Octopus", base: "#220038", glow: "#ffa2ff" },
    ],
  },
  {
    id: "birthday",
    label: "Birthday",
    description: "Balloons, ribbons, candles, invitations, and one very good cake.",
    options: [
      { emoji: "🎂", label: "Cake", base: "#d62f68", glow: "#ffe0ea" },
      { emoji: "🎈", label: "Balloon", base: "#168fe0", glow: "#dff2ff" },
      { emoji: "🎉", label: "Popper", base: "#8b5cf6", glow: "#eee7ff" },
      { emoji: "🪅", label: "Piñata", base: "#00a88f", glow: "#d2fff5" },
      { emoji: "🍰", label: "Slice", base: "#e66a16", glow: "#ffe4cc" },
      { emoji: "🎀", label: "Ribbon", base: "#c838a0", glow: "#ffddf4" },
      { emoji: "🎁", label: "Gift", base: "#2fae63", glow: "#d9ffe7" },
      { emoji: "🍭", label: "Lollipop", base: "#7d9800", glow: "#f1ffc2" },
    ],
  },
  {
    id: "party",
    label: "Pregame / Party",
    description: "A Norwegian-style pregame mix of drinks, party games, and the dance floor.",
    options: [
      { emoji: "🥃", label: "Whiskey", base: "#b86722", glow: "#ffe5c7" },
      { emoji: "🍺", label: "Beer", base: "#b88700", glow: "#fff0b5" },
      { emoji: "🍹", label: "Cocktail", base: "#00a58f", glow: "#d2fff5" },
      { emoji: "🍷", label: "Wine", base: "#b62e55", glow: "#ffdce5" },
      { emoji: "🎲", label: "Game", base: "#4f6ddb", glow: "#e1e7ff" },
      { emoji: "🕺", label: "Groove", base: "#8556d8", glow: "#eee4ff" },
      { emoji: "💃", label: "Flamenco", base: "#d44b2d", glow: "#ffe0d7" },
      { emoji: "🥂", label: "Cheers", base: "#62748a", glow: "#e8f0f7" },
    ],
  },
  {
    id: "halloween",
    label: "Halloween",
    description: "Pumpkin fire, a full moon, midnight creatures, and strange stone faces.",
    options: [
      { emoji: "🎃", label: "Pumpkin", base: "#d65a00", glow: "#ffe0bd" },
      { emoji: "👻", label: "Ghost", base: "#7b8492", glow: "#f0f3f7" },
      { emoji: "🦇", label: "Bat", base: "#7048a8", glow: "#ecdeff" },
      { emoji: "🕷️", label: "Spider", base: "#4d5968", glow: "#e7edf3" },
      { emoji: "🧛", label: "Vampire", base: "#b52d43", glow: "#ffd9df" },
      { emoji: "👹", label: "Demon", base: "#a94f16", glow: "#ffe1c9" },
      { emoji: "🐈‍⬛", label: "Black cat", base: "#008f88", glow: "#cdfffa" },
      { emoji: "🪦", label: "Tombstone", base: "#886450", glow: "#f2e2d7" },
      { emoji: "🌕", label: "Full moon", base: "#c49212", glow: "#fff1b8" },
    ],
  },
  {
    id: "easter",
    label: "Easter",
    description: "Spring flowers, painted eggs, Easter chocolate, and wrapped candy.",
    options: [
      { emoji: "🐣", label: "Chick", base: "#c28d00", glow: "#fff2b8" },
      { emoji: "🐰", label: "Rabbit", base: "#8b5fc7", glow: "#eee3ff" },
      { emoji: "🥚", label: "Egg", base: "#2f91c5", glow: "#ddf4ff" },
      { emoji: "🌷", label: "Tulip", base: "#d63873", glow: "#ffdeea" },
      { emoji: "🍫", label: "Chocolate", base: "#93633b", glow: "#f5e2d1" },
      { emoji: "🧺", label: "Basket", base: "#9b704f", glow: "#f3e2d5" },
      { emoji: "🍬", label: "Candy", base: "#c65098", glow: "#ffdef2" },
      { emoji: "🏔️", label: "Snowy mountain", base: "#169caa", glow: "#d4fbff" },
      { emoji: "🗿", label: "Moai", base: "#777c78", glow: "#eff2ef" },
    ],
  },
  {
    id: "mardi-gras",
    label: "Mardi Gras",
    description: "Bright carnival purple, green, and gold with New Orleans flavor.",
    options: [
      { emoji: "🎭", label: "Mask", base: "#a64ce6", glow: "#f3e3ff" },
      { emoji: "⚜️", label: "Fleur-de-lis", base: "#e0a400", glow: "#fff2b5" },
      { emoji: "📿", label: "Beads", base: "#00b968", glow: "#d5ffe9" },
      { emoji: "🎺", label: "Trumpet", base: "#d27600", glow: "#ffe7b8" },
      { emoji: "🪶", label: "Feather", base: "#1296be", glow: "#dcf7ff" },
      { emoji: "👑", label: "Carnival crown", base: "#8e55d6", glow: "#eee2ff" },
      { emoji: "🍹", label: "Hurricane", base: "#d94792", glow: "#ffddf1" },
      { emoji: "🦞", label: "Crawfish", base: "#e25b35", glow: "#ffe0d6" },
    ],
  },
  {
    id: "jul",
    label: "Christmas",
    description: "A crisp storybook Christmas in pine, cranberry, brass, snow, and winter glow.",
    options: [
      { emoji: "🎄", label: "Tree", base: "#0a9b58", glow: "#d5ffea" },
      { emoji: "🎁", label: "Gift", base: "#c72a5b", glow: "#ffdce6" },
      { emoji: "🔔", label: "Bell", base: "#b77a16", glow: "#ffe9ad" },
      { emoji: "❄️", label: "Snowflake", base: "#20a7db", glow: "#d8f6ff" },
      { emoji: "⭐️", label: "Star", base: "#ffd84d", glow: "#fff7c2" },
      { emoji: "🕯️", label: "Advent", base: "#8b5cf6", glow: "#eee7ff" },
      { emoji: "🎅", label: "Santa", base: "#e33d50", glow: "#ffdce0" },
      { emoji: "☃️", label: "Snowman", base: "#e07612", glow: "#ffe8cf" },
      { emoji: "🦌", label: "Reindeer", base: "#8a6347", glow: "#f2e2d6" },
    ],
  },
];

export const legacyTeamThemes: TeamTheme[] = [
  {
    id: "capra-liflig-preview",
    label: "Capra × Liflig preview",
    description: "Legacy palette",
    options: [
      { emoji: "🌊", label: "Warm Blue", base: "#004c61", glow: "#defcf5" },
      { emoji: "🔮", label: "Purple", base: "#4a11b7", glow: "#ffe8fe" },
      { emoji: "🌿", label: "Fresh Green", base: "#00ca97", glow: "#86ffd9" },
      { emoji: "🌸", label: "Pink", base: "#bb5ce9", glow: "#ffa2ff" },
      { emoji: "💎", label: "Spark", base: "#86ffd9", glow: "#defcf5" },
      { emoji: "🦋", label: "Pink Spark", base: "#ffa2ff", glow: "#ffe8fe" },
      { emoji: "🌌", label: "Capra Dark", base: "#0c1c35", glow: "#86ffd9" },
      { emoji: "🍇", label: "Liflig Dark", base: "#220038", glow: "#ffa2ff" },
    ],
  },

  {
    id: "birthday-v3",
    label: "Birthday",
    description: "Legacy palette",
    options: [
      { emoji: "🎂", label: "Cake", base: "#a61e4d", glow: "#ffd6e3" },
      { emoji: "🎈", label: "Balloon", base: "#1769aa", glow: "#d8eeff" },
      { emoji: "🎉", label: "Party popper", base: "#6d3fb3", glow: "#e7dcff" },
      { emoji: "🪅", label: "Piñata", base: "#007a70", glow: "#c8fff3" },
      { emoji: "🍰", label: "Slice", base: "#b54708", glow: "#ffe0c2" },
      { emoji: "🎀", label: "Ribbon", base: "#a51878", glow: "#ffd6f1" },
      { emoji: "📸", label: "Photo booth", base: "#446a1b", glow: "#e1f7bf" },
      { emoji: "🎟️", label: "Invitation", base: "#4f5d95", glow: "#e0e6ff" },
    ],
  },
  {
    id: "party-v2",
    label: "Pregame / Party",
    description: "Legacy palette",
    options: [
      { emoji: "🥃", label: "Whiskey", base: "#7a4215", glow: "#ffe0bd" },
      { emoji: "🍺", label: "Beer", base: "#806200", glow: "#ffecaa" },
      { emoji: "🍹", label: "Cocktail", base: "#007b6e", glow: "#c8fff3" },
      { emoji: "🍷", label: "Wine", base: "#81213b", glow: "#ffd7df" },
      { emoji: "🎲", label: "Party game", base: "#374b8a", glow: "#dce5ff" },
      { emoji: "🕺", label: "Groove", base: "#633a9e", glow: "#e7dcff" },
      { emoji: "💃", label: "Flamenco", base: "#a13a1f", glow: "#ffdbcf" },
      { emoji: "🥂", label: "Cheers", base: "#4b5563", glow: "#e5e7eb" },
    ],
  },
  {
    id: "halloween-v3",
    label: "Halloween",
    description: "Legacy palette",
    options: [
      { emoji: "🎃", label: "Pumpkin", base: "#a94700", glow: "#ffd9b3" },
      { emoji: "👻", label: "Ghost", base: "#5d6470", glow: "#eceff4" },
      { emoji: "🦇", label: "Bat", base: "#50307a", glow: "#e8dbff" },
      { emoji: "🕷️", label: "Spider", base: "#303a46", glow: "#e2e8f0" },
      { emoji: "🧛", label: "Vampire", base: "#8e2030", glow: "#ffd5da" },
      { emoji: "👹", label: "Demon", base: "#6f3b16", glow: "#ffe0c2" },
      { emoji: "🐈‍⬛", label: "Black cat", base: "#006b68", glow: "#c9fff8" },
      { emoji: "🪦", label: "Tombstone", base: "#6e4b3a", glow: "#f0ded3" },
      { emoji: "🌕", label: "Full moon", base: "#8e6610", glow: "#fff0ae" },
    ],
  },
  {
    id: "easter-v2",
    label: "Easter",
    description: "Legacy palette",
    options: [
      { emoji: "🐣", label: "Chick", base: "#8a6500", glow: "#fff0ae" },
      { emoji: "🐰", label: "Rabbit", base: "#6b45a1", glow: "#eadfff" },
      { emoji: "🥚", label: "Egg", base: "#246f9b", glow: "#d8f1ff" },
      { emoji: "🌷", label: "Tulip", base: "#a92355", glow: "#ffd8e5" },
      { emoji: "🍫", label: "Chocolate", base: "#76502f", glow: "#f2ddca" },
      { emoji: "🧺", label: "Basket", base: "#71513d", glow: "#f1ded0" },
      { emoji: "🍬", label: "Candy", base: "#9c3f79", glow: "#ffd9ef" },
      { emoji: "🏔️", label: "Snowy mountain", base: "#007a78", glow: "#c8fffb" },
      { emoji: "🗿", label: "Moai", base: "#5f625f", glow: "#ecefeb" },
    ],
  },
  {
    id: "mardi-gras-v2",
    label: "Mardi Gras",
    description: "Legacy palette",
    options: [
      { emoji: "🎭", label: "Mask", base: "#8b36d1", glow: "#f0ddff" },
      { emoji: "⚜️", label: "Fleur-de-lis", base: "#c18600", glow: "#fff0a6" },
      { emoji: "📿", label: "Beads", base: "#009e5a", glow: "#cdffe5" },
      { emoji: "🎺", label: "Trumpet", base: "#a85a00", glow: "#ffe0a6" },
      { emoji: "🪶", label: "Feather", base: "#087da3", glow: "#d5f4ff" },
      { emoji: "👑", label: "Carnival crown", base: "#713ab0", glow: "#eadcff" },
      { emoji: "🍹", label: "Hurricane", base: "#b52c73", glow: "#ffd5ec" },
      { emoji: "🦞", label: "Crawfish", base: "#c14924", glow: "#ffdbce" },
    ],
  },
  {
    id: "halloween-v2",
    label: "Halloween",
    description: "Legacy migration palette",
    options: [
      { emoji: "🎃", label: "Pumpkin", base: "#a94700", glow: "#ffd9b3" },
      { emoji: "👻", label: "Ghost", base: "#5d6470", glow: "#eceff4" },
      { emoji: "🦇", label: "Bat", base: "#50307a", glow: "#e8dbff" },
      { emoji: "🕷️", label: "Spider", base: "#303a46", glow: "#e2e8f0" },
      { emoji: "🧛", label: "Vampire", base: "#8e2030", glow: "#ffd5da" },
      { emoji: "👹", label: "Demon mask", base: "#8e2030", glow: "#ffd5da" },
      { emoji: "🐈‍⬛", label: "Black cat", base: "#006b68", glow: "#c9fff8" },
      { emoji: "🗿", label: "Moai", base: "#6e4b3a", glow: "#f0ded3" },
      { emoji: "🌕", label: "Full moon", base: "#8e6610", glow: "#fff0ae" },
    ],
  },
  {
    id: "birthday-v2",
    label: "Birthday",
    description: "Legacy palette",
    options: [
      { emoji: "🎂", label: "Cake", base: "#a61e4d", glow: "#ffd6e3" },
      { emoji: "🎈", label: "Balloon", base: "#1769aa", glow: "#d8eeff" },
      { emoji: "🎉", label: "Party popper", base: "#6d3fb3", glow: "#e7dcff" },
      { emoji: "🪅", label: "Piñata", base: "#007a70", glow: "#c8fff3" },
      { emoji: "🍰", label: "Slice", base: "#b54708", glow: "#ffe0c2" },
      { emoji: "🎀", label: "Ribbon", base: "#a51878", glow: "#ffd6f1" },
      { emoji: "🕯️", label: "Candle", base: "#446a1b", glow: "#e1f7bf" },
      { emoji: "🎟️", label: "Invitation", base: "#4f5d95", glow: "#e0e6ff" },
    ],
  },
  {
    id: "christmas-v2",
    label: "Christmas",
    description: "Legacy palette",
    options: [
      { emoji: "🎄", label: "Tree", base: "#087a45", glow: "#d1fae5" },
      { emoji: "🎁", label: "Gift", base: "#9b1b45", glow: "#ffd6e3" },
      { emoji: "🔔", label: "Bell", base: "#9a6818", glow: "#f2cf78" },
      { emoji: "❄️", label: "Snowflake", base: "#1686b8", glow: "#c9f2ff" },
      { emoji: "⭐️", label: "Star", base: "#ffd84d", glow: "#fff7c2" },
      { emoji: "🕯️", label: "Advent", base: "#7c3aed", glow: "#ddd6fe" },
      { emoji: "🎅", label: "Santa", base: "#c6283d", glow: "#fecdd3" },
      { emoji: "☃️", label: "Snowman", base: "#b85a0a", glow: "#fff0df" },
      { emoji: "🦌", label: "Reindeer", base: "#6d4c35", glow: "#efdfd2" },
    ],
  },
  {
    id: "birthday-v1",
    label: "Birthday",
    description: "Legacy palette",
    options: [
      { emoji: "🎂", label: "Cake", base: "#a61e4d", glow: "#ffd6e3" },
      { emoji: "🎈", label: "Balloon", base: "#1769aa", glow: "#d8eeff" },
      { emoji: "🧁", label: "Cupcake", base: "#6d3fb3", glow: "#e7dcff" },
      { emoji: "🪅", label: "Piñata", base: "#007a70", glow: "#c8fff3" },
      { emoji: "🍰", label: "Cake slice", base: "#b54708", glow: "#ffe0c2" },
      { emoji: "🥳", label: "Birthday cheer", base: "#4f5d95", glow: "#e0e6ff" },
      { emoji: "🍬", label: "Candy", base: "#446a1b", glow: "#e1f7bf" },
      { emoji: "🍭", label: "Lollipop", base: "#a51878", glow: "#ffd6f1" },
    ],
  },
  {
    id: "halloween-v1",
    label: "Halloween",
    description: "Legacy palette",
    options: [
      { emoji: "🎃", label: "Pumpkin", base: "#a94700", glow: "#ffd9b3" },
      { emoji: "👻", label: "Ghost", base: "#5d6470", glow: "#eceff4" },
      { emoji: "🦇", label: "Bat", base: "#50307a", glow: "#e8dbff" },
      { emoji: "🕷️", label: "Spider", base: "#303a46", glow: "#e2e8f0" },
      { emoji: "🧛", label: "Vampire", base: "#8e2030", glow: "#ffd5da" },
      { emoji: "🧟", label: "Zombie", base: "#40651d", glow: "#dcf7c2" },
      { emoji: "🐈‍⬛", label: "Black cat", base: "#006b68", glow: "#c9fff8" },
      { emoji: "🪦", label: "Gravestone", base: "#6e4b3a", glow: "#f0ded3" },
    ],
  },
  {
    id: "easter-v1",
    label: "Easter",
    description: "Legacy palette",
    options: [
      { emoji: "🐣", label: "Chick", base: "#8a6500", glow: "#fff0ae" },
      { emoji: "🐰", label: "Rabbit", base: "#6b45a1", glow: "#eadfff" },
      { emoji: "🥚", label: "Egg", base: "#246f9b", glow: "#d8f1ff" },
      { emoji: "🌷", label: "Tulip", base: "#a92355", glow: "#ffd8e5" },
      { emoji: "🥕", label: "Carrot", base: "#aa470b", glow: "#ffdec7" },
      { emoji: "🧺", label: "Basket", base: "#71513d", glow: "#f1ded0" },
      { emoji: "🌼", label: "Daisy", base: "#5f720b", glow: "#f1ffb8" },
      { emoji: "🦋", label: "Butterfly", base: "#007a78", glow: "#c8fffb" },
    ],
  },
  {
    id: "mardi-gras-v1",
    label: "Mardi Gras",
    description: "Legacy palette",
    options: [
      { emoji: "🎭", label: "Mask", base: "#65359a", glow: "#ebddff" },
      { emoji: "⚜️", label: "Fleur-de-lis", base: "#806400", glow: "#fff0a6" },
      { emoji: "📿", label: "Beads", base: "#147a50", glow: "#cdffe5" },
      { emoji: "🎺", label: "Trumpet", base: "#955100", glow: "#ffe0a6" },
      { emoji: "🪶", label: "Feather", base: "#176b87", glow: "#d5f4ff" },
      { emoji: "👑", label: "Carnival crown", base: "#962f69", glow: "#ffd8ed" },
      { emoji: "🥁", label: "Drum", base: "#873333", glow: "#ffd9d5" },
      { emoji: "🃏", label: "Carnival card", base: "#3c6428", glow: "#ddf7cc" },
    ],
  },
  {
    id: "christmas-v1",
    label: "Christmas",
    description: "Legacy palette",
    options: [
      { emoji: "🎄", label: "Tree", base: "#0b8a3b", glow: "#d1fae5" },
      { emoji: "🎁", label: "Gift", base: "#8f1230", glow: "#f7c948" },
      { emoji: "🔔", label: "Bell", base: "#9a6818", glow: "#f2cf78" },
      { emoji: "❄️", label: "Snow", base: "#28afe3", glow: "#c9f2ff" },
      { emoji: "⭐️", label: "Star", base: "#ffd84d", glow: "#fff7c2" },
      { emoji: "🕯️", label: "Candle", base: "#7c3aed", glow: "#ddd6fe" },
      { emoji: "🎅", label: "Santa", base: "#c6283d", glow: "#fecdd3" },
      { emoji: "☃️", label: "Snowman", base: "#d97706", glow: "#fff7ed" },
    ],
  },
  {
    id: "party-v1",
    label: "Pregame / Party",
    description: "Legacy palette",
    options: [
      { emoji: "🪩", label: "Disco", base: "#6542b5", glow: "#e8deff" },
      { emoji: "🍺", label: "Beer", base: "#8a5a00", glow: "#ffe5a3" },
      { emoji: "🍹", label: "Cocktail", base: "#007b6e", glow: "#c8fff3" },
      { emoji: "🎧", label: "DJ", base: "#285a9b", glow: "#d9e9ff" },
      { emoji: "🔊", label: "Speaker", base: "#4b5563", glow: "#e5e7eb" },
      { emoji: "🕺", label: "Dance", base: "#a3265a", glow: "#ffd4e3" },
      { emoji: "💃", label: "Dancer", base: "#a83d12", glow: "#ffddcc" },
      { emoji: "🥂", label: "Cheers", base: "#65720b", glow: "#efffb1" },
    ],
  },
  {
    id: "studio",
    label: "Studio",
    description: "Legacy palette",
    options: [
      { emoji: "🎯", label: "Target", base: "#f59e0b", glow: "#fff1c1" },
      { emoji: "🧠", label: "Mind", base: "#64748b", glow: "#e2e8f0" },
      { emoji: "📘", label: "Book", base: "#2563eb", glow: "#dbeafe" },
      { emoji: "🚀", label: "Rocket", base: "#ef4444", glow: "#fecaca" },
      { emoji: "🧩", label: "Puzzle", base: "#10b981", glow: "#bbf7d0" },
      { emoji: "🎲", label: "Dice", base: "#9333ea", glow: "#e9d5ff" },
      { emoji: "🪄", label: "Wand", base: "#ec4899", glow: "#fbcfe8" },
      { emoji: "🛰️", label: "Orbit", base: "#06b6d4", glow: "#a5f3fc" },
    ],
  },
  {
    id: "coast",
    label: "Coast",
    description: "Legacy palette",
    options: [
      { emoji: "🌊", label: "Wave", base: "#2563eb", glow: "#bfdbfe" },
      { emoji: "🐚", label: "Shell", base: "#9a6818", glow: "#fde68a" },
      { emoji: "🐬", label: "Dolphin", base: "#0ea5e9", glow: "#bae6fd" },
      { emoji: "🏖️", label: "Beach", base: "#e35d0a", glow: "#fed7aa" },
      { emoji: "🪸", label: "Coral", base: "#f43f5e", glow: "#fecdd3" },
      { emoji: "⚓️", label: "Anchor", base: "#0f172a", glow: "#cbd5f5" },
      { emoji: "⛵️", label: "Sail", base: "#14b8a6", glow: "#99f6e4" },
      { emoji: "🧭", label: "Compass", base: "#84cc16", glow: "#d9f99d" },
    ],
  },
  {
    id: "arcade",
    label: "Arcade",
    description: "Legacy palette",
    options: [
      { emoji: "👾", label: "Arcade", base: "#7c3aed", glow: "#c4b5fd" },
      { emoji: "🕹️", label: "Joystick", base: "#22c55e", glow: "#bbf7d0" },
      { emoji: "⚡️", label: "Bolt", base: "#eab308", glow: "#fef08a" },
      { emoji: "🎮", label: "Controller", base: "#3b82f6", glow: "#bfdbfe" },
      { emoji: "🧪", label: "Potion", base: "#14b8a6", glow: "#99f6e4" },
      { emoji: "🪩", label: "Disco", base: "#f43f5e", glow: "#fecdd3" },
      { emoji: "💿", label: "Disk", base: "#0f172a", glow: "#e2e8f0" },
      { emoji: "📼", label: "Tape", base: "#f97316", glow: "#fed7aa" },
    ],
  },
];

export const DEFAULT_THEME_ID = "jul";

export const LEGACY_THEME_REPLACEMENTS: Record<string, string> = {
  studio: "birthday",
  coast: "easter",
  arcade: "party",
};

export function getThemeById(themeId?: string) {
  const resolvedId = themeId ? (LEGACY_THEME_REPLACEMENTS[themeId] ?? themeId) : DEFAULT_THEME_ID;
  return teamThemes.find((theme) => theme.id === resolvedId)
    ?? teamThemes.find((theme) => theme.id === DEFAULT_THEME_ID)
    ?? teamThemes[0];
}

export function getThemeOptions(themeId?: string) {
  return getThemeById(themeId).options;
}

export function buildDefaultTeams(themeId?: string): Team[] {
  const theme = getThemeById(themeId);
  const options = theme.options;
  const defaultNames = theme.id === "jul"
    ? ["Team Granbar", "Team Gavebånd", "Team Bjelleklang"]
    : options.slice(0, 3).map((option) => `Team ${option.label}`);
  return [
    {
      id: makeId("team"),
      name: defaultNames[0] ?? "Team 1",
      score: 0,
      badgeEmoji: options[0].emoji,
      accentBase: options[0].base,
      accentGlow: options[0].glow,
      players: [
        { id: makeId("p"), name: "", placeholder: "Player 1" },
        { id: makeId("p"), name: "", placeholder: "Player 2" },
        { id: makeId("p"), name: "", placeholder: "Player 3" },
      ],
    },
    {
      id: makeId("team"),
      name: defaultNames[1] ?? "Team 2",
      score: 0,
      badgeEmoji: options[1].emoji,
      accentBase: options[1].base,
      accentGlow: options[1].glow,
      players: [
        { id: makeId("p"), name: "", placeholder: "Player 4" },
        { id: makeId("p"), name: "", placeholder: "Player 5" },
        { id: makeId("p"), name: "", placeholder: "Player 6" },
      ],
    },
    {
      id: makeId("team"),
      name: defaultNames[2] ?? "Team 3",
      score: 0,
      badgeEmoji: options[2].emoji,
      accentBase: options[2].base,
      accentGlow: options[2].glow,
      players: [
        { id: makeId("p"), name: "", placeholder: "Player 7" },
        { id: makeId("p"), name: "", placeholder: "Player 8" },
        { id: makeId("p"), name: "", placeholder: "Player 9" },
      ],
    },
  ];
}

export function buildDefaultQuestions(): Question[] {
  const base = (category: string, points: PointValue): Question => ({
    id: makeId("q"),
    category,
    points,
    prompt: "",
    answer: "",
    answered: false,
    type: "standard",
  });

  return [
    {
      ...base("NORSK JUL", 100),
      prompt: "Hva gjemmes tradisjonelt i julegrøten, og skal gi finneren hell?",
      answer: "En hel mandel.",
    },
    {
      ...base("NORSK JUL", 200),
      type: "mcq",
      prompt: "Hvor mange slag julekaker sier tradisjonen at man bør bake?",
      answer: "7 slag.",
      mcqOptions: ["7 slag", "9 slag", "11 slag", "13 slag"],
      mcqCorrectIndex: 0,
      mcqRotateOnMiss: true,
    },
    {
      ...base("NORSK JUL", 300),
      type: "lyrics",
      prompt: "Hvilken norsk julesang skjuler seg i rutene?",
      answer: "På låven sitter nissen.",
      lyricsInfoText: "Velg en rute. En rød rute sender turen videre uten å endre poengsummen.",
      lyricsSegments: ["På låven", "sitter nissen", "med sin julegrøt", "så god", "og så søt"],
      answerVideoAutoplay: false,
    },
    {
      ...base("NORSK JUL", 400),
      type: "timeline",
      prompt: "Plasser de norske TV-julekalenderne i riktig premiereår.",
      answer: "1979: Jul i Skomakergata · 1994: The Julekalender · 2000: Vazelina Hjulkalender · 2016: Snøfall.",
      timelineCenterYear: 1994,
      timelineCenterLabel: "1994 · The Julekalender",
      timelineTitle: "Norske TV-julekalendere",
      timelineRotateOnMiss: true,
      timelineEvents: [
        { id: makeId("tl"), text: "Jul i Skomakergata", year: 1979, timelineText: "1979 · Jul i Skomakergata" },
        { id: makeId("tl"), text: "Vazelina Hjulkalender", year: 2000, timelineText: "2000 · Vazelina Hjulkalender" },
        { id: makeId("tl"), text: "Snøfall", year: 2016, timelineText: "2016 · Snøfall" },
      ],
    },
    {
      ...base("NORSK JUL", 500),
      type: "geoguesser",
      prompt: "Hvilken norsk by står du i?",
      answer: "Bergen · Torgallmenningen.",
      mapEmbedUrl: "https://www.google.com/maps/embed?pb=!4v1765183753215!6m8!1m7!1sGxcEs3hTQa28F2Pdbjsm6g!2m2!1d60.39321104609752!2d5.324059880868293!3f167.38348572852502!4f14.484171742486694!5f0.7820865974627469",
      answerLocationLabel: "Torgallmenningen, Bergen",
      answerLocationUrl: "https://maps.google.com/?q=60.39321104609752,5.324059880868293",
      geoUnlockLevels: 1,
      geoExplorationMode: "look",
      geoTimerSeconds: 20,
    },
    {
      ...base("LYD & LERRET", 100),
      type: "audio",
      prompt: "Hvilken julesang hører vi? Artist og tittel gir full uttelling.",
      answer: "Last Christmas · Wham!",
      audioUrl: "https://www.youtube.com/watch?v=E8gmARGvPlI",
      audioStartSeconds: 18,
      audioStopSeconds: 12,
      audioReplayEnabled: true,
    },
    {
      ...base("LYD & LERRET", 200),
      prompt: "Hvilken by reiser familien McCallister fra når Kevin blir glemt hjemme i Home Alone?",
      answer: "Chicago.",
    },
    {
      ...base("LYD & LERRET", 300),
      type: "mcq",
      prompt: "Hva heter hovmesteren i Grevinnen og hovmesteren?",
      answer: "James.",
      mcqOptions: ["James", "Alfred", "Winston", "Charles"],
      mcqCorrectIndex: 0,
    },
    {
      ...base("LYD & LERRET", 400),
      type: "joker",
      prompt: "Er neste skjulte tall høyere eller lavere? Finn julejokeren!",
      answer: "Joker-runden er ferdig.",
      jokerCount: 5,
      jokerMin: 1,
      jokerMax: 9,
      jokerRotateOnMiss: true,
    },
    {
      ...base("LYD & LERRET", 500),
      type: "timeline",
      prompt: "Plasser julefilmene i riktig premiereår.",
      answer: "1946: It's a Wonderful Life · 1990: Home Alone · 2000: The Grinch · 2003: Love Actually · 2019: Klaus.",
      timelineCenterYear: 1990,
      timelineCenterLabel: "1990 · Home Alone",
      timelineTitle: "Julefilmer gjennom tidene",
      timelineRotateOnMiss: true,
      timelineEvents: [
        { id: makeId("tl"), text: "It's a Wonderful Life", year: 1946, timelineText: "1946 · It's a Wonderful Life" },
        { id: makeId("tl"), text: "How the Grinch Stole Christmas", year: 2000, timelineText: "2000 · How the Grinch Stole Christmas" },
        { id: makeId("tl"), text: "Love Actually", year: 2003, timelineText: "2003 · Love Actually" },
        { id: makeId("tl"), text: "Klaus", year: 2019, timelineText: "2019 · Klaus" },
      ],
    },
    {
      ...base("JUL VERDEN RUNDT", 100),
      prompt: "Hvilket land gir hvert år juletreet på Trafalgar Square i London?",
      answer: "Norge.",
    },
    {
      ...base("JUL VERDEN RUNDT", 200),
      type: "mcq",
      prompt: "I hvilket land har KFC blitt en kjent juletradisjon?",
      answer: "Japan.",
      mcqOptions: ["Japan", "Canada", "Brasil", "Sør-Afrika"],
      mcqCorrectIndex: 0,
      mcqRotateOnMiss: true,
    },
    {
      ...base("JUL VERDEN RUNDT", 300),
      type: "booby",
      prompt: "Mime tre juletradisjoner uten ord: pynte treet, pakke inn en gave og gå rundt juletreet. Laget må gjette alle tre.",
      answer: "Alle tre tradisjonene ble gjettet innen tiden.",
      challengeTimerSeconds: 60,
      challengeTimerMode: "countdown",
      challengeTimerShowTime: false,
    },
    {
      ...base("JUL VERDEN RUNDT", 400),
      prompt: "Julestjernen, planten med røde blader, kommer opprinnelig fra hvilket land?",
      answer: "Mexico.",
    },
    {
      ...base("JUL VERDEN RUNDT", 500),
      type: "geoguesser",
      prompt: "Utforsk stedet, plasser nålen og finn byen.",
      answer: "New Orleans, Louisiana, USA.",
      mapEmbedUrl: "https://www.google.com/maps/embed?pb=!4v1764969055025!6m8!1m7!1sfj0EC8FO4i4UKzSeguf61w!2m2!1d29.94909988802022!2d-90.07993276687564!3f333.2617552535312!4f22.208252430686443!5f0.7820865974627469",
      answerLocationLabel: "New Orleans, Louisiana, USA",
      answerLocationUrl: "https://maps.google.com/?q=29.94909988802022,-90.07993276687564",
      geoExplorationMode: "stage",
      geoStageExploreSeconds: 25,
      geoStageGuessSeconds: 20,
      geoStageDistanceBandsKm: [1, 5, 25, 100, 500],
      geoStageDistanceUnit: "km",
    },
  ];
}
