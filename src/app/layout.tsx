import type { Metadata } from "next";
import "./globals.css";
import "./company-theme.css";
import { AppHeader } from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "KimQuizak — host the room",
  description: "A tactile quiz-show control room for teams, questions, and live play.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <AppHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
