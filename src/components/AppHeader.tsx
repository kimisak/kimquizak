'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_SETTINGS } from "@/lib/settings";

export function AppHeader() {
  const pathname = usePathname();
  const [settings] = useSettings();
  const isHome = pathname === "/";
  const isGame = pathname === "/game";
  const title = settings.quizTitle || DEFAULT_SETTINGS.quizTitle;

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
