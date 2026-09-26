'use client';

import type { CSSProperties } from "react";
import { POINT_STEP, type Question, type ScoreTransaction, type Team } from "@/lib/types";
import { isQuestionReady } from "@/lib/questionValidation";
import { getTeamAccent, getTeamMarker } from "@/lib/teamPresentation";
import { TeamPill } from "./TeamPill";

type Props = {
  categories: string[];
  questions: Question[];
  teams?: Team[];
  scoreHistory?: ScoreTransaction[];
  concealCategoryHeaders?: boolean;
  revealedCategories?: Set<string>;
  onRevealCategory?: (category: string) => void;
  scoresHidden?: boolean;
  onOpen: (q: Question) => void;
};

export function BoardGrid({
  categories,
  questions,
  teams = [],
  scoreHistory = [],
  concealCategoryHeaders = false,
  revealedCategories = new Set<string>(),
  onRevealCategory,
  onOpen,
  scoresHidden = false,
}: Props) {
  const tileWidthFactor = Math.max(5.5, Math.min(10, 40 / Math.max(1, categories.length)));
  const highestPoints = Math.max(POINT_STEP, ...questions.map((question) => question.points));
  const rowCount = Math.ceil(highestPoints / POINT_STEP);
  const pointSizeFactor = Math.max(1.2, Math.min(4.4, (tileWidthFactor * 2.6) / rowCount));
  const setupSizeFactor = Math.max(0.62, Math.min(0.9, pointSizeFactor * 0.32));
  const pointValues = Array.from({ length: rowCount }, (_, index) => (index + 1) * POINT_STEP);
  return (
    <div className="quiz-board-scroll" role="region" aria-label="Quiz board">
    <div
      className="quiz-board"
      style={{
        "--board-columns": categories.length,
        "--board-rows": rowCount,
        "--board-tile-height": `clamp(58px, ${tileWidthFactor * 5 / rowCount}cqw, 150px)`,
        "--board-point-size": `clamp(1.15rem, ${pointSizeFactor}cqw, 3.8rem)`,
        "--board-setup-size": `clamp(.58rem, ${setupSizeFactor}cqw, .78rem)`,
        "--board-header-height": `clamp(54px, ${tileWidthFactor * 0.48}cqw, 84px)`,
        display: "grid",
        gridTemplateColumns: `repeat(${categories.length}, minmax(140px, 1fr))`,
        gap: "8px",
        minWidth: `${Math.max(680, categories.length * 150)}px`,
      } as CSSProperties}
    >
      {categories.map((category, index) => {
        const isConcealed = concealCategoryHeaders && !revealedCategories.has(category);
        return isConcealed ? (
          <button
            key={category}
            type="button"
            className="quiz-board-header concealed"
            onClick={() => onRevealCategory?.(category)}
            aria-label={`Reveal category ${index + 1}`}
          >
            <span aria-hidden>✦</span>
            Reveal category {index + 1}
          </button>
        ) : (
          <div key={category} className="quiz-board-header revealed">
            {category}
          </div>
        );
      })}

      {pointValues.map((points) =>
        categories.map((category) => {
          const q = questions.find(
            (question) =>
              question.category === category && question.points === points,
          );
          if (!q) {
            return <span key={`${category}-${points}`} className="quiz-board-empty" aria-hidden="true" />;
          }
          const ready = isQuestionReady(q);
          const disabled = q?.answered || !ready;
          const matchingResults = q?.answered
            ? scoreHistory.filter((entry) => entry.questionId === q.id)
            : [];
          const legacyResult = q?.answered && q.type !== "booby" && matchingResults.length === 0
            ? scoreHistory.find((entry) => entry.reason.startsWith(`${category} · ${points}`))
            : undefined;
          const resultByTeam = [...matchingResults, ...(legacyResult ? [legacyResult] : [])]
            .reduce<Map<string, ScoreTransaction>>((results, entry) => {
              const existing = results.get(entry.teamId);
              results.set(entry.teamId, existing
                ? { ...existing, delta: existing.delta + entry.delta }
                : entry);
              return results;
            }, new Map());
          const results = Array.from(resultByTeam.values())
            .filter((entry) => entry.delta !== 0 || q?.type === "booby" || q?.type === "geoguesser")
            .sort((first, second) => second.delta - first.delta);
          const visibleResults = scoresHidden ? [] : results;
          return (
            <button
              key={`${category}-${points}`}
              className={`quiz-board-tile${q?.answered ? " played" : ""}${visibleResults.length ? " scored" : ""}${visibleResults.length > 1 ? " multi-score" : ""}${!ready ? " needs-setup" : ""}`}
              disabled={disabled}
              aria-label={`${category}, ${points} points${q?.answered ? visibleResults.length ? `, played, ${visibleResults.map((result) => `${result.teamName} ${result.delta === 0 ? "received 0" : `${result.delta > 0 ? "gained" : "lost"} ${Math.abs(result.delta)}`} points`).join(", ")}` : scoresHidden ? ", played, score hidden" : ", played" : !ready ? ", needs setup" : ""}`}
              onClick={() => ready && onOpen(q)}
            >
              {q?.answered ? (
                visibleResults.length ? (
                  <span className={`tile-result${visibleResults.length > 1 ? " tile-result-list" : ""}`}>
                    {visibleResults.map((result) => {
                      const resultTeam = teams.find((team) => team.id === result.teamId);
                      const resultAccent = resultTeam ? getTeamAccent(resultTeam) : undefined;
                      return (
                        <span
                          className="tile-result-entry"
                          key={result.teamId}
                          style={resultAccent ? {
                            "--result-color-on-dark": resultAccent.onDark,
                            "--result-color-on-light": resultAccent.onLight,
                            "--result-glow": resultAccent.glow,
                          } as CSSProperties : undefined}
                        >
                          {q.type === "booby" && resultTeam ? (
                            <span className="tile-result-identity"><TeamPill name={result.teamName} color={resultAccent?.base} emoji={getTeamMarker(resultTeam)} /></span>
                          ) : (
                            <strong className="tile-result-team">
                              {resultTeam && <span aria-hidden="true">{getTeamMarker(resultTeam)}</span>}
                              <span>{result.teamName}</span>
                            </strong>
                          )}
                          <span className={result.delta >= 0 ? "tile-result-score won" : "tile-result-score lost"}>
                            {result.delta === 0 ? "0 pts" : `${result.delta > 0 ? "+" : ""}${result.delta}`}
                          </span>
                        </span>
                      );
                    })}
                  </span>
                ) : (
                  <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Played
                  </span>
                )
              ) : <span className="tile-points">{points}</span>}
              {!ready && (
                <span className="tile-setup-label">
                  needs setup
                </span>
              )}
            </button>
          );
        }),
      )}
    </div>
    </div>
  );
}
