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
    id: "studio",
    label: "Studio",
    description: "Gold-to-white core with colorful, polished accents.",
    options: [
      { emoji: "🎯", label: "Target", base: "#f59e0b", glow: "#fff1c1" },
      { emoji: "🧠", label: "Mind", base: "#f8fafc", glow: "#ffffff" },
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
    description: "Ocean blues and sunlit accents.",
    options: [
      { emoji: "🌊", label: "Wave", base: "#2563eb", glow: "#bfdbfe" },
      { emoji: "🐚", label: "Shell", base: "#f59e0b", glow: "#fde68a" },
      { emoji: "🐬", label: "Dolphin", base: "#0ea5e9", glow: "#bae6fd" },
      { emoji: "🏖️", label: "Beach", base: "#f97316", glow: "#fed7aa" },
      { emoji: "🪸", label: "Coral", base: "#f43f5e", glow: "#fecdd3" },
      { emoji: "⚓️", label: "Anchor", base: "#0f172a", glow: "#cbd5f5" },
      { emoji: "⛵️", label: "Sail", base: "#14b8a6", glow: "#99f6e4" },
      { emoji: "🧭", label: "Compass", base: "#84cc16", glow: "#d9f99d" },
    ],
  },
  {
    id: "arcade",
    label: "Arcade",
    description: "High-energy neon, perfect for late-night rounds.",
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
  {
    id: "jul",
    label: "Jul",
    description: "Classic festive reds, greens, and winter sparkle.",
    options: [
      { emoji: "🎄", label: "Tree", base: "#0b8a3b", glow: "#d1fae5" },
      { emoji: "🎁", label: "Gift", base: "#b9001f", glow: "#f7c948" },
      { emoji: "🔔", label: "Bell", base: "#b03060", glow: "#ffd6e0" },
      { emoji: "❄️", label: "Snow", base: "#0f4c75", glow: "#b0e0ff" },
      { emoji: "⭐️", label: "Star", base: "#b8860b", glow: "#ffe29f" },
      { emoji: "🕯️", label: "Candle", base: "#f4a259", glow: "#ffe8c2" },
      { emoji: "🎅", label: "Santa", base: "#d62828", glow: "#ffb3b3" },
      { emoji: "☃️", label: "Snowman", base: "#4ba3c7", glow: "#d9f2ff" },
    ],
  },
];

export const DEFAULT_THEME_ID = "studio";

export function getThemeById(themeId?: string) {
  return teamThemes.find((theme) => theme.id === themeId) ?? teamThemes[0];
}

export function getThemeOptions(themeId?: string) {
  return getThemeById(themeId).options;
}

export function buildDefaultTeams(themeId?: string): Team[] {
  const options = getThemeOptions(themeId);
  return [
    {
      id: makeId("team"),
      name: "Team Aurora",
      score: 0,
      badgeEmoji: options[0].emoji,
      accentBase: options[0].base,
      accentGlow: options[0].glow,
      players: [
        { id: makeId("p"), name: "Player 1" },
        { id: makeId("p"), name: "Player 2" },
        { id: makeId("p"), name: "Player 3" },
      ],
    },
    {
      id: makeId("team"),
      name: "Team Horizon",
      score: 0,
      badgeEmoji: options[1].emoji,
      accentBase: options[1].base,
      accentGlow: options[1].glow,
      players: [
        { id: makeId("p"), name: "Player 1" },
        { id: makeId("p"), name: "Player 2" },
        { id: makeId("p"), name: "Player 3" },
      ],
    },
    {
      id: makeId("team"),
      name: "Team Nova",
      score: 0,
      badgeEmoji: options[2].emoji,
      accentBase: options[2].base,
      accentGlow: options[2].glow,
      players: [
        { id: makeId("p"), name: "Player 1" },
        { id: makeId("p"), name: "Player 2" },
        { id: makeId("p"), name: "Player 3" },
      ],
    },
  ];
}

export function buildDefaultQuestions(): Question[] {
  const category = "Jul i Norge";
  const base = (points: PointValue): Question => ({
    id: makeId("q"),
    category,
    points,
    prompt: "",
    answer: "",
    answered: false,
    imageData: null,
    imageName: null,
    answerImageData: null,
    answerImageName: null,
    type: "standard",
    lyricsSegments: [],
    mapEmbedUrl: null,
    answerLocationLabel: null,
    answerLocationUrl: null,
    answerVideoUrl: null,
    answerVideoAutoplay: true,
    geoUnlockCost: 0,
    jokerCount: 5,
    jokerMin: 1,
    jokerMax: 9,
    jokerIncrement: 100,
    timelineCenterYear: 1950,
    timelineCenterLabel: "Midten av 1900-tallet (1950)",
    timelineTitle: "Jul i Norge",
    timelineEvents: [],
    jokerRotateOnMiss: true,
    timelineRotateOnMiss: true,
    mcqOptions: [],
    mcqCorrectIndex: 0,
    audioUrl: null,
    audioStopSeconds: null,
    audioStartSeconds: null,
  });

  return [
    {
      ...base(100),
      type: "standard",
      prompt:
        "Hvilket krydder gir pepperkaker smaken sin, og var en luksusvare i Norge før julen ble kommersialisert?",
      answer: "Ingefær (med nellik og kanel som støtter smaker).",
    },
    {
      ...base(200),
      type: "mcq",
      prompt: "Hvor mange slag julekaker sier tradisjonen at man bør bake?",
      mcqOptions: ["7 slag", "9 slag", "11 slag", "13 slag"],
      mcqCorrectIndex: 0,
      mcqRotateOnMiss: false,
      answer: "7 slag",
    },
    {
      ...base(300),
      type: "lyrics",
      prompt: "Gjett sangen!",
      answerVideoUrl: "https://www.youtube.com/embed/_uv74o8hG30?si=6SvaaogCRd80KARm&start=6",
      answerVideoAutoplay: false,
      lyricsSegments: ["med", "sin", "julegrøt", "så", "god", "og", "søt"],
      answer: "På låven sitter nissen med sin julegrøt",
    },
    {
      ...base(400),
      type: "timeline",
      prompt: "Plasser hendelsene om norske juletradisjoner i riktig rekkefølge.",
      timelineCenterYear: 1950,
      timelineCenterLabel: "Midten av 1900-tallet (1950)",
      timelineTitle: "Jul i Norge",
      timelineEvents: [
        {
          id: makeId("tl"),
          text: "Norge sender første julegran til London etter krigen",
          year: 1947,
          timelineText: "1947: Treet til Trafalgar Square",
        },
        {
          id: makeId("tl"),
          text: "\"Tre nøtter til Askepott\" blir fast på NRK",
          year: 1973,
          timelineText: "1973: TV-tradisjonen starter",
        },
        {
          id: makeId("tl"),
          text: "NRK introduserer moderne julekalender-serier i primetime",
          year: 2016,
          timelineText: "2016: \"Snøfall\" blir en ny tradisjon",
        },
      ],
      answer:
        "Kronologi: 1947 (julegran til London), 1973 (Tre nøtter til Askepott), 2016 (Snøfall).",
    },
    {
      ...base(500),
      type: "geoguesser",
      prompt: "Hvor i Norge er dette ikoniske julepyntede stedet?",
      mapEmbedUrl:
        "https://www.google.com/maps/embed?pb=!4v1765183753215!6m8!1m7!1sGxcEs3hTQa28F2Pdbjsm6g!2m2!1d60.39321104609752!2d5.324059880868293!3f167.38348572852502!4f14.484171742486694!5f0.7820865974627469",
      answerLocationLabel: "Torgallmenningen, Bergen",
      answerLocationUrl: "https://maps.google.com/?q=60.39321104609752,5.324059880868293",
      answer: "Torgallmenningen, Bergen",
    },
  ];
}
