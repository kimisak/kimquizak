import { POINT_VALUES, type PointValue, type Question, type Team } from "@/lib/types";

export function makeId(prefix: string) {
  return `${prefix}-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2))}`;
}

export const emojiOptions = [
  { emoji: "🎄", label: "Tree", base: "#0b8a3b", glow: "#d1fae5" },
  { emoji: "⭐️", label: "Star", base: "#b8860b", glow: "#ffe29f" },
  { emoji: "🔔", label: "Bell", base: "#b03060", glow: "#ffd6e0" },
  { emoji: "❄️", label: "Snow", base: "#0f4c75", glow: "#b0e0ff" },
  { emoji: "🎁", label: "Gift", base: "#b9001f", glow: "#f7c948" },
  { emoji: "🕯️", label: "Candle", base: "#f4a259", glow: "#ffe8c2" },
  { emoji: "🎅", label: "Santa", base: "#d62828", glow: "#ffb3b3" },
  { emoji: "😇", label: "Angel", base: "#cbbaf0", glow: "#f2eaff" },
  { emoji: "☃️", label: "Snowman", base: "#4ba3c7", glow: "#d9f2ff" },
  { emoji: "🍷", label: "Wine", base: "#6b2737", glow: "#f5c3d0" },
  { emoji: "🍺", label: "Beer", base: "#d19c1d", glow: "#ffeac2" },
  { emoji: "🦌", label: "Reindeer", base: "#8b5a2b", glow: "#f3d6b3" },
  { emoji: "🍪", label: "Cookie", base: "#c68642", glow: "#ffe3c4" },
  { emoji: "🥛", label: "Milk", base: "#9bc4f5", glow: "#e9f5ff" },
  { emoji: "🥕", label: "Carrot", base: "#f7931e", glow: "#ffe0b3" },
  { emoji: "💝", label: "Heart Bow", base: "#ff5c8a", glow: "#ffd1e6" },
  { emoji: "🛷", label: "Sleigh", base: "#b22234", glow: "#ffd7c2" },
  { emoji: "📜", label: "Scroll", base: "#d7b468", glow: "#fff4cf" },
  { emoji: "🍬", label: "Candy", base: "#ff6fb7", glow: "#ffd6ec" },
  { emoji: "🌠", label: "Shooting Star", base: "#4f46e5", glow: "#c7d2fe" },
];

export function buildDefaultTeams(): Team[] {
  return [
    {
      id: makeId("team"),
      name: "Pepperkakelaget",
      score: 0,
      badgeEmoji: emojiOptions[12].emoji,
      accentBase: emojiOptions[12].base,
      accentGlow: emojiOptions[12].glow,
      players: [
        { id: makeId("p"), name: "Player 1" },
        { id: makeId("p"), name: "Player 2" },
        { id: makeId("p"), name: "Player 3" },
      ],
    },
    {
      id: makeId("team"),
      name: "Stjerneskudd",
      score: 0,
      badgeEmoji: emojiOptions[19].emoji,
      accentBase: emojiOptions[19].base,
      accentGlow: emojiOptions[19].glow,
      players: [
        { id: makeId("p"), name: "Player 1" },
        { id: makeId("p"), name: "Player 2" },
        { id: makeId("p"), name: "Player 3" },
      ],
    },
    {
      id: makeId("team"),
      name: "Bjelleklang",
      score: 0,
      badgeEmoji: emojiOptions[2].emoji,
      accentBase: emojiOptions[2].base,
      accentGlow: emojiOptions[2].glow,
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
