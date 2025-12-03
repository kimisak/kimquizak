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
}: Props) {
  const activeEvent = queue[0];
  const formatYear = (year: number | null | undefined) => {
    if (year === null || year === undefined) return "Unknown";
    if (year < 0) return `${Math.abs(year)} BC`;
    return `${year}`;
  };

  const combined = [
    ...placedLeft.map((e) => ({ ...e, side: "left" as const })),
    { id: "__center", text: "Center", year: centerYear, side: "center" as const },
    ...placedRight.map((e) => ({ ...e, side: "right" as const })),
  ].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  const slots: { label: string; index: number; onYear?: number }[] = [];
  if (combined.length) {
    slots.push({ label: `Before ${formatYear(combined[0].year)}`, index: 0 });
    combined.forEach((item, idx) => {
      const isCenter = item.id === "__center";
      slots.push({
        label: `On ${formatYear(item.year)}`,
        index: idx,
        onYear: item.year ?? undefined,
      });
      const next = combined[idx + 1];
      if (next && next.year !== item.year) {
        slots.push({
          label: `Between ${formatYear(item.year)} and ${formatYear(next.year)}`,
          index: idx + 1,
        });
      }
    });
    slots.push({
      label: `After ${formatYear(combined[combined.length - 1]?.year ?? centerYear)}`,
      index: combined.length,
    });
  }

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
          alignItems: "center",
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
          <div style={{ fontWeight: 800, fontSize: "2rem" }}>Year {formatYear(centerYear)}</div>
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
        <button className="button ghost" onClick={onClose}>
          Close
        </button>
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
        Drag or click to place the event before or after the center year. Wrong guesses remove the
        event. Final correct placement wins the points.
      </div>

      <div style={{ display: "grid", gap: "12px", marginBottom: "12px" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          {combined.map((ev) => (
            <div
              key={ev.id}
              className="card"
              style={{
                padding: "8px",
                minWidth: "110px",
                textAlign: "center",
                border: ev.side === "center" ? "2px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.16)",
                background: ev.side === "center" ? "linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.08))" : "rgba(255,255,255,0.06)",
                boxShadow: "0 6px 14px rgba(0,0,0,0.25)",
              }}
            >
              <div style={{ fontWeight: 800 }}>{formatYear(ev.year)}</div>
              <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                {ev.side === "center" ? "Center year" : ev.text}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gap: "8px",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {slots.map((label, idx) => (
            <button
              key={`${idx}-${slots[idx]?.onYear ?? "slot"}`}
              className="button ghost"
              disabled={disableActions}
              onClick={() => onPlace(slots[idx] ?? { index: idx })}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!disableActions) onPlace(slots[idx] ?? { index: idx });
              }}
              style={{ width: "100%" }}
            >
              {slots[idx]?.label ?? label}
            </button>
          ))}
        </div>
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
          {winnerName
            ? `Congrats, ${winnerName} earned ${points ?? 0} points!`
            : "No more events to place."}
        </div>
      )}
    </div>
  );
}
