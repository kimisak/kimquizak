import type { Metadata } from "next";
import "./globals.css";
import "./company-theme.css";
import { AppHeader } from "@/components/AppHeader";
import { SITE_THEME_BOOTSTRAP } from "@/lib/siteTheme";

export const metadata: Metadata = {
  metadataBase: new URL("https://kimquizak.com"),
  title: "KimQuizak — Remember the game",
  description: "Your questions. Your teams. Their bragging rights. Build a quiz full of trivia, puzzles and surprises, and run the show live with KimQuizak.",
  openGraph: {
    type: "website",
    siteName: "KimQuizak",
    title: "KimQuizak — Remember the game",
    description: "Your questions. Your teams. Their bragging rights. Build a quiz full of trivia, puzzles and surprises, and run the show live.",
  },
  twitter: {
    card: "summary_large_image",
    title: "KimQuizak — Remember the game",
    description: "Your questions. Your teams. Their bragging rights. Build your quiz and run the show live.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script id="site-theme-bootstrap" dangerouslySetInnerHTML={{ __html: SITE_THEME_BOOTSTRAP }} />
      </head>
      <body>
        <div className="app-shell">
          <AppHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
