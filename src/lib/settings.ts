export type AppSettings = {
  quizTitle: string;
  themeId: string;
  hideCategoryHeadersAtStart: boolean;
  finaleMusicEnabled: boolean;
  finaleMusicUrl: string;
  finaleMusicStartSeconds: number;
  finaleMusicDurationSeconds: number;
  finaleMusicVolume: number;
};

export const SETTINGS_STORAGE_KEY = "kimquizak_settings_v1";

export const DEFAULT_SETTINGS: AppSettings = {
  quizTitle: "Quiz Night",
  themeId: "studio",
  hideCategoryHeadersAtStart: true,
  finaleMusicEnabled: true,
  finaleMusicUrl: "https://youtu.be/9QS0q3mGPGg?t=84",
  finaleMusicStartSeconds: 84,
  finaleMusicDurationSeconds: 24,
  finaleMusicVolume: 35,
};
