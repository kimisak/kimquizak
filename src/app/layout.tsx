import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Julebord Games",
  description: "Party board and config for the Christmas table games",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "32px 28px 64px",
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "28px",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
              <Link
                href="/"
                style={{
                  fontSize: "1.7rem",
                  fontWeight: 800,
                  padding: "10px 14px",
                  borderRadius: "999px",
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.05)",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                🎄 Julebord Games
              </Link>
            </div>
            <nav
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                justifyContent: "flex-end",
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
              <a
                className="button ghost"
                href="https://github.com/kimisak/Julebord-Games"
                target="_blank"
                rel="noreferrer"
              >
                Source code
              </a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
