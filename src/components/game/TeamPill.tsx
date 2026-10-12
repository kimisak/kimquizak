'use client';

import { TeamEmoji } from "./TeamEmoji";
import type { CSSProperties } from "react";
import { getEmojiSurface } from "@/lib/teamPresentation";

type Props = {
  name?: string;
  color?: string;
  emoji?: string | null;
  label?: string;
};

type EditableProps = {
  name: string;
  color?: string;
  emoji?: string | null;
  choices: Array<{ emoji: string; label: string }>;
  onNameChange: (name: string) => void;
  onEmojiChange: (emoji: string) => void;
  teamLabel: string;
};

export function TeamPill({ name, color = "#f2c14f", emoji = "⭐️", label }: Props) {
  if (!name) return null;
  return (
    <span className="team-pill-wrap">
      {label && <span className="team-pill-label">{label}</span>}
      <span
        className="team-pill team-identity-surface"
        data-emoji-surface={getEmojiSurface(emoji)}
        style={{
          "--team-color": color,
        } as CSSProperties}
      >
        <span className="team-pill-emoji team-identity-emoji" aria-hidden><TeamEmoji emoji={emoji} color={color} /></span>
        <span className="team-pill-name">{name}</span>
      </span>
    </span>
  );
}

export function EditableTeamPill({
  name,
  color = "#f2c14f",
  emoji = "⭐️",
  choices,
  onNameChange,
  onEmojiChange,
  teamLabel,
}: EditableProps) {
  return (
    <span className="team-pill-wrap team-pill-editor-wrap">
      <span
        className="team-pill team-pill-editor team-identity-surface"
        data-emoji-surface={getEmojiSurface(emoji)}
        style={{
          "--team-color": color,
          "--team-name-width": `${Math.max(9, Math.min(name.length + 4, 28))}ch`,
        } as CSSProperties}
      >
        <span className="team-pill-emoji-editor team-identity-emoji">
          <span aria-hidden><TeamEmoji emoji={emoji} color={color} /></span>
          <select
            value={emoji ?? ""}
            onChange={(event) => onEmojiChange(event.target.value)}
            aria-label={`Change style for ${teamLabel}`}
            title="Change team style"
          >
            {choices.map((choice) => (
              <option key={choice.emoji} value={choice.emoji}>
                {choice.emoji} {choice.label}
              </option>
            ))}
          </select>
        </span>
        <input
          className="team-pill-name-editor"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          aria-label={`Team name for ${teamLabel}`}
          placeholder="Team name"
          title="Edit team name"
        />
      </span>
    </span>
  );
}
