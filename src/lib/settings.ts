export type HostMessageRevealStyle = "spin-wheel" | "direct";

export type HostMessage = {
  id: string;
  afterQuestionCount: number;
  text: string;
  revealStyle?: HostMessageRevealStyle;
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
  hostMessages: HostMessage[];
};

export const SETTINGS_STORAGE_KEY = "kimquizak_settings_v1";

export const DEFAULT_SETTINGS: AppSettings = {
  quizTitle: "Quiz Night",
  themeId: "studio",
  hideCategoryHeadersAtStart: true,
  finaleMusicEnabled: true,
  finaleMusicUrl: "https://youtu.be/9QS0q3mGPGg?t=84",
  finaleMusicStartSeconds: 84,
  finaleMusicEndSeconds: 108,
  finaleMusicVolume: 35,
  hostMessages: [],
};
