'use client';

import { useEffect, useState } from "react";
import { POINT_VALUES, type Question } from "@/lib/types";

type Props = {
  categories: string[];
  questions: Question[];
  onOpen: (q: Question) => void;
};

export function BoardGrid({ categories, questions, onOpen }: Props) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 700px)");
    const listener = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };
    // Set initial
    listener(mq);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener as EventListener);
  }, []);

  const useSplit = isMobile && categories.length > 2;

  if (useSplit) {
    const rows: React.ReactNode[] = [];
    for (let i = 0; i < categories.length; i += 2) {
      const slice = categories.slice(i, i + 2);
      rows.push(
        <div
          key={`headers-${i}`}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${slice.length}, minmax(140px, 1fr))`,
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          {slice.map((category) => (
            <div
              key={category}
              className="card"
              style={{
                padding: "12px",
                textAlign: "center",
                fontWeight: 700,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                background:
                  "linear-gradient(135deg, rgba(207,45,45,0.5), rgba(28,111,77,0.5))",
              }}
            >
              {category}
            </div>
          ))}
        </div>,
      );
      POINT_VALUES.forEach((points, rowIdx) => {
        rows.push(
          <div
            key={`row-${i}-${rowIdx}`}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${slice.length}, minmax(140px, 1fr))`,
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            {slice.map((category) => {
              const q = questions.find(
                (question) =>
                  question.category === category && question.points === points,
              );
              const disabled = q?.answered;
              return (
                <button
                  key={`${category}-${points}`}
                  disabled={!q || disabled}
                  onClick={() => q && onOpen(q)}
                  style={{
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: disabled
                      ? "rgba(255,255,255,0.08)"
                      : "linear-gradient(135deg, rgba(0,114,187,0.55), rgba(21,55,105,0.9))",
                    color: disabled ? "var(--muted)" : "#f7f4ec",
                    fontWeight: 800,
                    fontSize: "1.4rem",
                    padding: "18px 10px",
                    borderRadius: "12px",
                    cursor: disabled ? "not-allowed" : "pointer",
                    position: "relative",
                    textShadow: disabled ? "none" : "0 2px 6px rgba(0,0,0,0.35)",
                  }}
                >
                  {points}
                  {disabled && (
                    <span
                      style={{
                        position: "absolute",
                        top: "8px",
                        right: "10px",
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      answered
                    </span>
                  )}
                  {!q && (
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        opacity: 0.8,
                      }}
                    >
                      missing clue
                    </span>
                  )}
                </button>
              );
            })}
          </div>,
        );
      });
    }
    return <div style={{ display: "grid", gap: "6px" }}>{rows}</div>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${categories.length}, minmax(140px, 1fr))`,
        gap: "8px",
      }}
    >
      {categories.map((category) => (
        <div
          key={category}
          className="card"
          style={{
            padding: "12px",
            textAlign: "center",
            fontWeight: 700,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            background:
              "linear-gradient(135deg, rgba(207,45,45,0.5), rgba(28,111,77,0.5))",
          }}
        >
          {category}
        </div>
      ))}

      {POINT_VALUES.map((points) =>
        categories.map((category) => {
          const q = questions.find(
            (question) =>
              question.category === category && question.points === points,
          );
          const disabled = q?.answered;
          return (
            <button
              key={`${category}-${points}`}
              disabled={!q || disabled}
              onClick={() => q && onOpen(q)}
              style={{
                border: "1px solid rgba(255,255,255,0.14)",
                background: disabled
                  ? "rgba(255,255,255,0.08)"
                  : "linear-gradient(135deg, rgba(0,114,187,0.55), rgba(21,55,105,0.9))",
                color: disabled ? "var(--muted)" : "#f7f4ec",
                fontWeight: 800,
                fontSize: "1.4rem",
                padding: "18px 10px",
                borderRadius: "12px",
                cursor: disabled ? "not-allowed" : "pointer",
                position: "relative",
                textShadow: disabled ? "none" : "0 2px 6px rgba(0,0,0,0.35)",
              }}
            >
              {points}
              {disabled && (
                <span
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "10px",
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  answered
                </span>
              )}
              {!q && (
                <span
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    opacity: 0.8,
                  }}
                >
                  missing clue
                </span>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
