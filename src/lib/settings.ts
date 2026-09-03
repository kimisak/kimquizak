export type AppSettings = {
  quizTitle: string;
  themeId: string;
  hideCategoryHeadersAtStart: boolean;
};

export const SETTINGS_STORAGE_KEY = "kimquizak_settings_v1";

export const DEFAULT_SETTINGS: AppSettings = {
  quizTitle: "Quiz Night",
  themeId: "studio",
  hideCategoryHeadersAtStart: true,
};
