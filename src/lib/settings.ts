export type AppSettings = {
  quizTitle: string;
  themeId: string;
};

export const SETTINGS_STORAGE_KEY = "kimquizak_settings_v1";

export const DEFAULT_SETTINGS: AppSettings = {
  quizTitle: "Quiz Night",
  themeId: "studio",
};
