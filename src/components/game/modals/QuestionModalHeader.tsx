'use client';

import { TeamPill } from "@/components/game/TeamPill";

type Props = {
  category: string;
  typeLabel: string;
  points: number;
  teamName?: string;
  teamColor?: string;
  teamEmoji?: string | null;
  teamLabel?: string;
};

export function QuestionModalHeader({
  category,
  typeLabel,
  points,
  teamName,
  teamColor,
  teamEmoji,
  teamLabel = "Answering",
}: Props) {
  return (
    <header className="question-modal-header">
      <div className="question-modal-heading">
        <span>{category} · {typeLabel}</span>
        <strong>{points}<small> pts</small></strong>
      </div>
      {teamName && (
        <div className="question-modal-team-context">
          <small>{teamLabel}</small>
          <TeamPill name={teamName} color={teamColor} emoji={teamEmoji} />
        </div>
      )}
    </header>
  );
}
