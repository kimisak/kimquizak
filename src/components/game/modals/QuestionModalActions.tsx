'use client';

import type { ReactNode } from "react";

type Props = {
  revealed: boolean;
  onReveal?: () => void;
  onCorrect?: () => void;
  onWrong?: () => void;
  disabled?: boolean;
  before?: ReactNode;
};

export function QuestionModalActions({
  revealed,
  onReveal,
  onCorrect,
  onWrong,
  disabled = false,
  before,
}: Props) {
  return (
    <footer className="question-modal-actions">
      <div className="question-modal-actions-secondary">{before}</div>
      {revealed ? (
        <div className="question-modal-score-actions">
          <button className="button question-score-wrong" type="button" onClick={onWrong} disabled={disabled}>
            <span aria-hidden>×</span> Wrong
          </button>
          <button className="button question-score-correct" type="button" onClick={onCorrect} disabled={disabled}>
            <span aria-hidden>✓</span> Correct
          </button>
        </div>
      ) : (
        <button className="button question-reveal-answer" type="button" onClick={onReveal}>
          Reveal answer
        </button>
      )}
    </footer>
  );
}
