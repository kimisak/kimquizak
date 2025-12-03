'use client';

import type { TimelineEvent } from "@/lib/types";

type Props = {
  centerYear: number;
  currentTeamName?: string;
  queue: TimelineEvent[];
  placedLeft: TimelineEvent[];
  placedRight: TimelineEvent[];
  onPlace: (slot: { index: number; onYear?: number | null }) => void;
  onClose: () => void;
  disableActions?: boolean;
  winnerName?: string | null;
  points?: number;
  rotateInfo?: boolean;
  noWinner?: boolean;
  title?: string | null;
  centerLabel?: string | null;
  potentialScore?: number | null;
  basePoints?: number | null;
};

export function TimelineModal({
  centerYear,
  currentTeamName,
  queue,
  placedLeft,
  placedRight,
  onPlace,
  onClose,
  disableActions,
  winnerName,
  points,
  rotateInfo,
  noWinner,
  title,
  centerLabel,
  potentialScore,
  basePoints,
}: Props) {
  const activeEvent = queue[0];
  const formatYear = (year: number | null | undefined) => {
    if (year === null || year === undefined) return "Unknown";
    if (year < 0) return `${Math.abs(year)} BC`;
    return `${year}`;
  };

  const combined = [
    ...placedLeft.map((e) => ({ ...e, side: "left" as const })),
    { id: "__center", text: "Center", year: centerYear, side: "center" as const, timelineText: undefined },
    ...placedRight.map((e) => ({ ...e, side: "right" as const })),
  ].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  const groups = combined.reduce<
    Array<{
      year: number | null | undefined;
      side: typeof combined[number]["side"];
      events: typeof combined;
      startIndex: number;
    }>
  >((acc, ev, idx) => {
    const last = acc[acc.length - 1];
    if (last && last.year === ev.year) {
      last.events.push(ev);
    } else {
      acc.push({ year: ev.year, side: ev.side, events: [ev], startIndex: idx });
    }
    return acc;
  }, []);

  const renderDropZone = (slot: { index: number; onYear?: number }, size: "thin" | "wide" = "thin") => (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!disableActions) onPlace(slot);
      }}
      style={{
        minWidth: size === "wide" ? "20px" : "12px",
        minHeight: "60px",
        border: "1px dashed rgba(255,255,255,0.18)",
        borderRadius: "10px",
        display: "grid",
        placeItems: "center",
        padding: size === "wide" ? "8px" : "4px",
        background: "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0, rgba(255,255,255,0.06) 8px, rgba(255,255,255,0.03) 8px, rgba(255,255,255,0.03) 16px)",
      }}
    />
  );

  return (
    <div
      className="card"
      style={{
        padding: "20px",
        background: "rgba(10, 12, 18, 0.96)",
        borderColor: "rgba(255,255,255,0.18)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "12px",
          gap: "10px",
        }}
      >
        <div style={{ display: "grid", gap: "4px" }}>
          <div
            style={{
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--muted)",
            }}
          >
            Timeline
          </div>
          {title ? (
            <div style={{ fontWeight: 800, fontSize: "1.2rem" }}>{title}</div>
          ) : null}
          {winnerName ? (
            <div style={{ color: "#f2c14f", fontSize: "0.95rem", fontWeight: 700 }}>
              Winner: {winnerName}
            </div>
          ) : currentTeamName ? (
            <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
              Guessing: <strong style={{ color: "#f2c14f" }}>{currentTeamName}</strong>
            </div>
          ) : null}
        </div>
        {(potentialScore || basePoints) && (
          <div
            style={{
              borderRadius: "12px",
              padding: "8px 12px",
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.05)",
              display: "grid",
              gap: "4px",
              minWidth: "140px",
              textAlign: "right",
            }}
          >
            <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Question score</div>
            {basePoints !== null && basePoints !== undefined ? (
              <div style={{ fontWeight: 700 }}>Base: {basePoints}</div>
            ) : null}
            {potentialScore !== null && potentialScore !== undefined ? (
              <div style={{ fontWeight: 700, color: "#f2c14f" }}>Current: {potentialScore}</div>
            ) : null}
          </div>
        )}
      </div>

      <div
        style={{
          padding: "12px",
          borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.03)",
          marginBottom: "12px",
          color: "var(--muted)",
        }}
      >
        Drag to place the event on/around the correct year. Wrong guesses are marked and {rotateInfo ? "pass play to the next team." : "stay with the same team."} Final correct placement wins the points.
      </div>

      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "stretch",
          flexWrap: "wrap",
          justifyContent: "center",
          marginBottom: "12px",
        }}
      >
        {groups.length > 0 && renderDropZone({ index: 0 }, "wide")}
        {groups.map((group, groupIdx) => {
          const hasCorrect = group.events.some((ev) => ev.status === "correct");
          const hasWrong = group.events.some((ev) => ev.status === "wrong");
          const status = hasCorrect ? "correct" : hasWrong ? "wrong" : "pending";
          const textColor =
            status === "correct"
              ? "#5eead4"
              : status === "wrong"
                ? "#fca5a5"
                : "var(--foreground)";
          const borderColor =
            group.side === "center"
              ? "rgba(255,255,255,0.3)"
              : status === "correct"
                ? "rgba(28,111,77,0.8)"
                : status === "wrong"
                  ? "rgba(185,28,28,0.8)"
                  : "rgba(255,255,255,0.16)";

          const nextIndex = group.startIndex + group.events.length;

          return (
            <div key={`${group.year}-${groupIdx}`} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!disableActions) onPlace({ index: group.startIndex, onYear: group.year ?? undefined });
                }}
                className="card"
                style={{
                  padding: "10px",
                  minWidth: "140px",
                  textAlign: "center",
                  border: `2px solid ${borderColor}`,
                  background: group.side === "center"
                    ? "linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.08))"
                    : "rgba(255,255,255,0.06)",
                  boxShadow: "0 6px 14px rgba(0,0,0,0.25)",
                }}
              >
                <div style={{ fontWeight: 800, color: textColor }}>
                  {formatYear(group.year)}
                </div>
                <div style={{ display: "grid", gap: "6px", marginTop: "6px" }}>
                  {group.events.map((ev, i) => (
                    <div
                      key={`${ev.id}-${i}`}
                      style={{
                        color: ev.status === "correct" ? "#5eead4" : ev.status === "wrong" ? "#fca5a5" : "var(--muted)",
                        fontSize: "0.9rem",
                        lineHeight: 1.4,
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                        paddingTop: "4px",
                      }}
                    >
                      {ev.side === "center"
                        ? centerLabel || ev.timelineText || "Center year"
                        : ev.timelineText ?? ev.text}
                    </div>
                  ))}
                </div>
              </div>
              {groupIdx === groups.length - 1
                ? renderDropZone({ index: nextIndex }, "wide")
                : renderDropZone({ index: nextIndex }, "wide")}
            </div>
          );
        })}
      </div>

      {activeEvent ? (
        <div
      draggable={!disableActions}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", activeEvent.id)}
      style={{
        border: "1px solid rgba(255,255,255,0.16)",
        borderRadius: "12px",
        padding: "12px",
        background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
        boxShadow: "0 8px 16px rgba(0,0,0,0.3)",
        cursor: disableActions ? "not-allowed" : "grab",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: "6px" }}>Place this event</div>
      <div style={{ fontSize: "1.1rem" }}>{activeEvent.text || "(No description)"}</div>
    </div>
  ) : (
        <div
          style={{
            padding: "12px",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--muted)",
          }}
        >
          {winnerName ? (
            <span>
              Congrats, <strong style={{ color: "#f2c14f" }}>{winnerName}</strong> earned{" "}
              <strong style={{ color: "#f2c14f" }}>{potentialScore ?? points ?? 0}</strong> points!
            </span>
          ) : noWinner ? (
            <span style={{ color: "#f2c14f", fontWeight: 700 }}>No team earned points.</span>
          ) : (
            "No more events to place."
          )}
        </div>
      )}
    </div>
  );
}
