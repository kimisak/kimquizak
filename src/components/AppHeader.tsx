'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_SETTINGS } from "@/lib/settings";

export function AppHeader() {
  const pathname = usePathname();
  const [settings] = useSettings();
  const isHome = pathname === "/";
  const title = isHome
    ? "kimquizak"
    : settings.quizTitle || DEFAULT_SETTINGS.quizTitle;

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "28px",
        gap: "12px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <Link
          href="/"
          aria-label={title}
          style={{
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <img
            src="/kimquizak-logo.svg"
            alt="kimquizak"
            width={260}
            height={86}
            style={{
              display: "block",
              objectFit: "contain",
              maxWidth: "70vw",
              height: "auto",
            }}
          />
        </Link>
      </div>
      <nav
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          justifyContent: "flex-end",
          overflowX: "auto",
          paddingBottom: "4px",
        }}
      >
        <Link className="button ghost" href="/config/teams">
          Teams
        </Link>
        <Link className="button ghost" href="/config/questions">
          Questions
        </Link>
        <Link className="button secondary" href="/game">
          Game board
        </Link>
      </nav>
    </header>
  );
}
