'use client';

import type { ComponentPropsWithRef, ReactNode } from "react";

// Faces belong in the mood badge. Gestures and objects remain separate effects.
const faces = new Set("🫡 🙂 😌 😐 🤔 🤓 🧐 😶 😙 🙃 😴 😊 😗 😰 😬 🫣 🤯 😵‍💫 😱 😶‍🌫️ 🫨 🥶 😈 😚 🥰 😇 😍 🤗 🥹 🥴 🤪 😄 😎 😠 😮‍💨 🥳 😂 🤣 😲 😆 🤭 🤨 😮 😁 🤩 😤 😅 😃 😯 😉 😏 😳 😢 😭".split(" "));
const reactionFaces: Record<string, string> = { "👋": "😊", "🙌": "😄", "🤞": "😬", "👀": "😯", "⏳": "😐", "🗣️": "😃", "🍺": "🥴", "🥂": "🥴", "🍷": "🥴" };

type Props = ComponentPropsWithRef<"li"> & {
  name: string;
  marker: ReactNode;
  mood: string;
};

export function PlayerPill({ name, marker, mood, className = "", children, ...props }: Props) {
  const isFace = faces.has(mood);
  return (
    <li {...props} className={`scoreboard-player ${className}`}>
      <span className="scoreboard-player-marker" aria-hidden>{marker}</span>
      <span className="scoreboard-player-name">{name}</span>
      <span className="scoreboard-player-mood" aria-hidden>{isFace ? mood : reactionFaces[mood] ?? "🙂"}</span>
      {!isFace && <span className="scoreboard-player-reaction" aria-hidden>{mood}</span>}
      {children}
    </li>
  );
}
