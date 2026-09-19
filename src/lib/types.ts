export const POINT_VALUES = [100, 200, 300, 400, 500] as const;
export const POINT_STEP = 100;
export type PointValue = number;

export type PlayerBondKind = "sweethearts" | "engaged" | "married" | "parents" | "drinking-buddies";

export type PlayerBond = {
  playerId: string;
  kind: PlayerBondKind;
};

export type PlayerGender = "M" | "F";

export type Player = {
  id: string;
  name: string;
  gender?: PlayerGender;
  placeholder?: string;
  bonds?: PlayerBond[];
  /** Legacy singular connection, migrated by the team configuration page. */
  bond?: PlayerBond | null;
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
  type?: "standard" | "lyrics" | "geoguesser" | "joker" | "timeline" | "mcq" | "audio" | "booby";
  lyricsSegments?: string[];
  lyricsInfoText?: string | null;
  mapEmbedUrl?: string | null;
  answerLocationLabel?: string | null;
  answerLocationUrl?: string | null;
  answerVideoUrl?: string | null;
  answerVideoAutoplay?: boolean | null;
  geoTimerSeconds?: number | null;
  geoUnlockCost?: number | null;
  geoUnlockLevels?: 1 | 2 | null;
  geoExplorationMode?: "timed" | "look" | "free" | "stage" | null;
  geoStageExploreSeconds?: number | null;
  geoStageGuessSeconds?: number | null;
  geoStageDistanceBandsKm?: number[] | null;
  geoStageDistanceUnit?: "km" | "m" | null;
  challengeTimerSeconds?: number | null;
  challengeTimerMode?: "countdown" | "countup" | null;
  challengeTimerShowTime?: boolean | null;
  lyricsRedPattern?: number[];
  jokerNumbers?: number[];
  jokerTargets?: number[];
  jokerJokerIndex?: number | null;
  jokerJokerPosition?: "above" | "below" | null;
  jokerCount?: number | null;
  jokerMin?: number | null;
  jokerMax?: number | null;
  timelineCenterYear?: number | null;
  timelineCenterLabel?: string | null;
  timelineTitle?: string | null;
  timelineEvents?: TimelineEvent[];
  jokerRotateOnMiss?: boolean | null;
  timelineRotateOnMiss?: boolean | null;
  mcqRotateOnMiss?: boolean | null;
  mcqOptions?: string[];
  mcqCorrectIndex?: number | null;
  audioUrl?: string | null;
  audioStopSeconds?: number | null;
  audioStartSeconds?: number | null;
  audioReplayEnabled?: boolean | null;
};

export type TeamMap = Record<string, Team>;
export type QuestionMap = Record<string, Question>;

export type ScoreTransaction = {
  id: string;
  teamId: string;
  teamName: string;
  delta: number;
  reason: string;
  createdAt: string;
  questionId?: string;
};

export type ResolvedHostMessage = {
  text: string;
  variables: Record<string, string>;
  randomSelections?: Array<{
    kind: "team" | "player" | "number";
    value: string;
    candidates: string[];
    selectedIndex: number;
    teamId?: string;
    playerId?: string;
    rangeStart?: number;
    rangeEnd?: number;
    launchX?: number;
    launchVelocityX?: number;
    wheelInitialAngularVelocity?: number;
    wheelAngularDeceleration?: number;
    wheelStartAngle?: number;
    candidateIds?: Array<{
      teamId?: string;
      playerId?: string;
    }>;
    physicsVersion?: number;
  }>;
};

export type TurnState = {
  order: string[];
  boardIndex: number;
  lyricsIndex: number;
  revealedCategories?: string[];
  dismissedHostMessageIds?: string[];
  resolvedHostMessages?: Record<string, ResolvedHostMessage>;
  audioPlaybackCounts?: Record<string, number>;
  audioReplayValues?: Record<string, number>;
  scoresHidden?: boolean;
  hiddenScoreOrder?: string[];
};

export type TimelineEvent = {
  id: string;
  text: string; // prompt text before placement
  year: number | null;
  isBC?: boolean | null;
  timelineText?: string | null; // what shows on the timeline after placement
};
