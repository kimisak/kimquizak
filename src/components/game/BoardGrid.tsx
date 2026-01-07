'use client';

import { useEffect, useMemo, useState } from "react";
import { POINT_VALUES, type Question } from "@/lib/types";
import { useSettings } from "@/hooks/useSettings";
import { getThemeById } from "@/lib/defaultData";

type Props = {
  categories: string[];
  questions: Question[];
  onOpen: (q: Question) => void;
};

export function BoardGrid({ categories, questions, onOpen }: Props) {
  const [settings] = useSettings();
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 700 : false,
  );

  const headerBackground = useMemo(() => {
    const theme = getThemeById(settings.themeId);
    const base = theme.options[0]?.base ?? "#3b82f6";
    const accent = theme.options[1]?.base ?? theme.options[0]?.glow ?? "#14b8a6";

    const toRgba = (hex: string, alpha: number) => {
      const clean = hex.replace("#", "");
      const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
      const num = Number.parseInt(full, 16);
      if (Number.isNaN(num)) return `rgba(59,130,246,${alpha})`;
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    return `linear-gradient(135deg, ${toRgba(base, 0.55)}, ${toRgba(accent, 0.55)})`;
  }, [settings.themeId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 700px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    const handleResize = () => update();
    window.addEventListener("resize", handleResize);
    return () => {
      mql.removeEventListener("change", update);
      window.removeEventListener("resize", handleResize);
    };
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
                background: headerBackground,
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
            background: headerBackground,
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
