'use client';

import Link from "next/link";
import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { useSettings } from "@/hooks/useSettings";
import { getThemeById } from "@/lib/defaultData";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from "@/lib/settings";

export function AppHeader() {
  const pathname = usePathname();
  const [settings, , settingsHydrated] = useSettings();
  const isHome = pathname === "/";
  const isGame = pathname === "/game";
  const title = settings.quizTitle || DEFAULT_SETTINGS.quizTitle;
  const siteTheme = settings.companyBranding === true ? getThemeById(settings.themeId).id : undefined;

  useLayoutEffect(() => {
    let theme = siteTheme;
    // Preserve the early script's choice until settings load. Reapply it before
    // paint if development Strict Mode resets the document's attributes.
    if (!settingsHydrated) {
      try {
        const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "null");
        theme = stored?.companyBranding === true ? getThemeById(stored.themeId).id : undefined;
      } catch { /* Keep the default when browser storage is unavailable. */ }
    }
    if (theme) document.documentElement.dataset.siteTheme = theme;
    else delete document.documentElement.dataset.siteTheme;
  }, [siteTheme, settingsHydrated]);

  const navItems = [
    { href: "/config/teams", number: "01", label: "Teams" },
    { href: "/config/questions", number: "02", label: "Questions" },
    { href: "/game", number: "03", label: "Play" },
    { href: "/account", number: "04", label: "Host" },
  ];

  return (
    <header className={`site-header${isGame ? " game-header" : ""}`}>
      <Link href="/" aria-label={isHome ? "KimQuizak home" : `${title} — KimQuizak home`} className="brand-lockup">
        <span className="brand-stamp" aria-hidden>KQ</span>
        <span className="brand-wordmark">
          <strong>KIMQUIZAK</strong>
          <small>{isGame ? title : "HOST THE ROOM"}</small>
        </span>
      </Link>
      <nav className="site-nav" aria-label="Primary navigation">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              <span>{item.number}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
