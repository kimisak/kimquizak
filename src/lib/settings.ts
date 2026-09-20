import { DEFAULT_THEME_ID } from "@/lib/defaultData";

export type HostMessageRevealStyle = "spin-wheel" | "direct";

export type HostMessage = {
  id: string;
  afterQuestionCount: number;
  text: string;
  revealStyle?: HostMessageRevealStyle;
};

export type BoardRevealRule =
  | { when: "category-complete"; category: string }
  | { when: "board-complete" };

export type BoardRevealRules = {
  categories?: Record<string, BoardRevealRule>;
  rows?: Record<string, BoardRevealRule>;
  questions?: Record<string, BoardRevealRule>;
};

export type AppSettings = {
  quizTitle: string;
  themeId: string;
  hideCategoryHeadersAtStart: boolean;
  finaleMusicEnabled: boolean;
  finaleMusicUrl: string;
  finaleMusicStartSeconds: number;
  finaleMusicEndSeconds: number;
  finaleMusicDurationSeconds?: number;
  finaleMusicVolume: number;
  stagedPodiumReveal: boolean;
  hostMessages: HostMessage[];
  boardRevealRules?: BoardRevealRules;
};

export const SETTINGS_STORAGE_KEY = "kimquizak_settings_v1";

export const DEFAULT_SETTINGS: AppSettings = {
  quizTitle: "Quiz Night",
  themeId: DEFAULT_THEME_ID,
  hideCategoryHeadersAtStart: true,
  finaleMusicEnabled: true,
  finaleMusicUrl: "https://youtu.be/9QS0q3mGPGg?t=84",
  finaleMusicStartSeconds: 84,
  finaleMusicEndSeconds: 108,
  finaleMusicVolume: 35,
  stagedPodiumReveal: true,
  hostMessages: [],
  boardRevealRules: {},
};
