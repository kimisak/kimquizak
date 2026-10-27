export type HostScene = {
  id: string;
  title: string;
  ending: string;
  lines: { speaker: "host" | "player"; text: string; mood: "talking" | "laughing" }[];
};

// Local, authored scripts. Keep scene selection separate from presentation so a
// future source of dialogue can use the same format without changing gameplay.
export const HOST_SCENES: readonly HostScene[] = [
  {
    id: "expert", title: "Kveldens ekspert", ending: "En høyst uoffisiell ekspertmedalje deles ut. 🏅",
    lines: [
      { speaker: "host", text: "{player}, du virker veldig sikker på neste kategori.", mood: "talking" },
      { speaker: "player", text: "Jeg har sett én TikTok om temaet.", mood: "talking" },
      { speaker: "host", text: "Da er du dessverre overkvalifisert.", mood: "laughing" },
    ],
  },
  {
    id: "appeal", title: "En formell klage", ending: "Klagen arkiveres i en usynlig skuff. 🗄️",
    lines: [
      { speaker: "player", text: "På vegne av {team} vil jeg klage på fasiten.", mood: "talking" },
      { speaker: "host", text: "Vi har ikke stilt spørsmålet ennå.", mood: "talking" },
      { speaker: "player", text: "Vi liker å være tidlig ute.", mood: "laughing" },
    ],
  },
  {
    id: "bribe", title: "Et fristende tilbud", ending: "En imaginær kjeks bytter eier. Poengene står urørt. 🍪",
    lines: [
      { speaker: "player", text: "{host}, hva koster et lite hint? Jeg har en kjeks.", mood: "talking" },
      { speaker: "host", text: "Jeg lar meg ikke bestikke.", mood: "talking" },
      { speaker: "player", text: "Den har sjokoladebiter.", mood: "laughing" },
    ],
  },
  {
    id: "speech", title: "Takketalen", ending: "Mikrofonen trekkes forsiktig tilbake. 🎤",
    lines: [
      { speaker: "player", text: "Jeg vil først takke laget, familien og Wikipedia.", mood: "talking" },
      { speaker: "host", text: "{player}, dette er bare en pause.", mood: "talking" },
      { speaker: "player", text: "Da sparer jeg resten til pausen etterpå.", mood: "laughing" },
    ],
  },
  {
    id: "confidence", title: "Sterk lagånd", ending: "Laget får et meget selvsikkert nikk. 😎",
    lines: [
      { speaker: "host", text: "Hvordan er stemningen hos {team}?", mood: "talking" },
      { speaker: "player", text: "Vi er enige om at vi har rett.", mood: "talking" },
      { speaker: "host", text: "Da mangler dere bare å bli enige med fasiten.", mood: "laughing" },
    ],
  },
  {
    id: "lifeline", title: "Ring en venn", ending: "En telefon uten dekning legges tilbake i lomma. 📵",
    lines: [
      { speaker: "player", text: "Kan jeg ringe en venn?", mood: "talking" },
      { speaker: "host", text: "Vennene dine sitter på laget ditt.", mood: "talking" },
      { speaker: "player", text: "Det er derfor jeg spør.", mood: "laughing" },
    ],
  },
];

export function chooseHostScene(previousId?: string): HostScene {
  const choices = HOST_SCENES.filter(scene => scene.id !== previousId);
  return choices[Math.floor(Math.random() * choices.length)];
}

export function formatHostLine(text: string, names: { host: string; player: string; team: string }) {
  return text.replace(/\{(host|player|team)\}/g, (_, key: keyof typeof names) => names[key]);
}
