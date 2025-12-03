export const POINT_VALUES = [100, 200, 300, 400, 500] as const;
export type PointValue = (typeof POINT_VALUES)[number];

export type Player = {
  id: string;
  name: string;
};

export type Team = {
  id: string;
  name: string;
  players: Player[];
  score: number;
  badgeEmoji?: string | null;
  accentBase?: string | null;
  accentGlow?: string | null;
};

export type Question = {
  id: string;
  category: string;
  points: PointValue;
  prompt: string;
  answer: string;
  answered: boolean;
  imageData?: string | null;
  imageName?: string | null;
  answerImageData?: string | null;
  answerImageName?: string | null;
  type?: "standard" | "lyrics" | "geoguesser" | "joker" | "timeline" | "mcq";
  lyricsSegments?: string[];
  mapEmbedUrl?: string | null;
  answerLocationLabel?: string | null;
  answerLocationUrl?: string | null;
  answerVideoUrl?: string | null;
  answerVideoAutoplay?: boolean | null;
  geoTimerSeconds?: number | null;
  geoUnlockCost?: number | null;
  lyricsRedPattern?: number[];
  jokerNumbers?: number[];
  jokerTargets?: number[];
  jokerJokerIndex?: number | null;
  jokerJokerPosition?: "above" | "below" | null;
  jokerCount?: number | null;
  jokerMin?: number | null;
  jokerMax?: number | null;
  jokerIncrement?: number | null;
  timelineCenterYear?: number | null;
  timelineCenterLabel?: string | null;
  timelineTitle?: string | null;
  timelineEvents?: TimelineEvent[];
  jokerRotateOnMiss?: boolean | null;
  timelineRotateOnMiss?: boolean | null;
  mcqRotateOnMiss?: boolean | null;
  mcqOptions?: string[];
  mcqCorrectIndex?: number | null;
};

export type TeamMap = Record<string, Team>;
export type QuestionMap = Record<string, Question>;

export type TurnState = {
  order: string[];
  boardIndex: number;
  lyricsIndex: number;
};

export type TimelineEvent = {
  id: string;
  text: string; // prompt text before placement
  year: number | null;
  isBC?: boolean | null;
  timelineText?: string | null; // what shows on the timeline after placement
};
