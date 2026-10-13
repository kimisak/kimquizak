import { DEFAULT_THEME_ID, LEGACY_THEME_REPLACEMENTS, teamThemes } from "@/lib/defaultData";
import { SETTINGS_STORAGE_KEY } from "@/lib/settings";

// Only repository-owned constants enter this script; saved values are read at runtime.
// Run while parsing <head>, before either the page content or React is painted.
export const SITE_THEME_BOOTSTRAP = `(() => {
  try {
    const settings = JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_STORAGE_KEY)}) || "null");
    if (settings?.companyBranding !== true) return;
    const themes = ${JSON.stringify(Object.fromEntries([
      ...teamThemes.map(theme => [theme.id, theme.id]),
      ...Object.entries(LEGACY_THEME_REPLACEMENTS),
    ]))};
    const theme = themes[settings.themeId];
    document.documentElement.dataset.siteTheme = typeof theme === "string" ? theme : ${JSON.stringify(DEFAULT_THEME_ID)};
  } catch { /* Unavailable or invalid browser storage keeps the default appearance. */ }
})();`;
