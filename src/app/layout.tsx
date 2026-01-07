import type { Metadata } from "next";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "kimquizak",
  description: "Quiz board and configuration toolkit for team game nights.",
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
            padding: "clamp(20px, 4vw, 32px) clamp(14px, 4vw, 28px) 64px",
          }}
        >
          <AppHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
