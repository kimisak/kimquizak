'use client';

import { useRef, useState, type CSSProperties } from "react";
import type { TimelineEvent } from "@/lib/types";
import { TeamPill } from "@/components/game/TeamPill";
import { QuestionModalHeader } from "./QuestionModalHeader";

type PlacedEvent = TimelineEvent & { status?: "correct" | "wrong" };

type Props = {
  category?: string;
  centerYear: number;
  currentTeamId?: string;
  currentTeamName?: string;
  currentTeamColor?: string;
  currentTeamEmoji?: string | null;
  queue: PlacedEvent[];
  placedLeft: PlacedEvent[];
  placedRight: PlacedEvent[];
  onPlace: (slot: { index: number; onYear?: number | null }) => void;
  onClose: () => void;
  disableActions?: boolean;
  scoreResults?: Array<{
    teamId: string;
    teamName: string;
    teamColor: string;
    teamEmoji?: string | null;
    correctCount: number;
    wrongCount: number;
    points: number;
  }>;
  points?: number;
  rotateInfo?: boolean;
  noWinner?: boolean;
  title?: string | null;
  centerLabel?: string | null;
  potentialScore?: number | null;
  basePoints?: number | null;
};

function formatYear(year: number | null | undefined) {
  if (year === null || year === undefined) return "Unknown";
  if (year < 0) return `${Math.abs(year)} BC`;
  return `${year}`;
}

export function TimelineModal({
  category,
  centerYear,
  currentTeamId,
  currentTeamName,
  currentTeamColor,
  currentTeamEmoji,
  queue,
  placedLeft,
  placedRight,
  onPlace,
  onClose,
  disableActions,
  scoreResults = [],
  points,
  rotateInfo,
  noWinner,
  title,
  centerLabel,
  potentialScore,
  basePoints,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const activeEvent = queue[0];
  const combined = [
    ...placedLeft.map((event) => ({ ...event, side: "left" as const })),
    {
      id: "__center",
      text: "Center",
      year: centerYear,
      side: "center" as const,
      timelineText: undefined,
      status: undefined,
    },
    ...placedRight.map((event) => ({ ...event, side: "right" as const })),
  ].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  const groups = combined.reduce<
    Array<{
      year: number | null | undefined;
      side: typeof combined[number]["side"];
      events: typeof combined;
      startIndex: number;
    }>
  >((accumulator, event, index) => {
    const previous = accumulator[accumulator.length - 1];
    if (previous && previous.year === event.year) {
      previous.events.push(event);
    } else {
      accumulator.push({ year: event.year, side: event.side, events: [event], startIndex: index });
    }
    return accumulator;
  }, []);

  const remainingCount = queue.length;
  const totalCount = combined.length + remainingCount - 1;
  const placedCount = Math.max(0, totalCount - remainingCount);
  const timelineDensity = groups.length > 12 ? "dense" : groups.length > 6 ? "compact" : "comfortable";
  const timelineCapacity = totalCount > 12 ? "dense" : totalCount > 6 ? "compact" : "comfortable";
  const largestYearStack = Math.max(1, ...groups.map((group) => group.events.length));
  const timelineStack = largestYearStack > 4 ? "deep" : largestYearStack > 1 ? "stacked" : "single";
  const isComplete = !activeEvent && (scoreResults.length > 0 || Boolean(noWinner));
  const distributedPoints = scoreResults.reduce((sum, result) => sum + result.points, 0);
  const compactScores = scoreResults.length >= 4;
  const instruction = rotateInfo
    ? "A correct placement earns one share of the points. A wrong card returns to the back of the deck without revealing its year. The next team takes the next card; no points are lost."
    : "A correct placement earns one share of the points. A wrong card returns to the back of the deck without revealing its year. The same team takes the next card; no points are lost."

  const renderDropZone = (slot: { index: number; onYear?: number | null }, key: string) => (
    <div
      key={key}
      className={`timeline-drop-zone${disableActions ? " disabled" : ""}`}
      role="group"
      aria-label="Timeline placement slot"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        if (!disableActions) onPlace(slot);
      }}
    >
      <span aria-hidden>+</span>
    </div>
  );

  return (
    <article className={`card round-stage round-timeline question-modal-card timeline-question-modal timeline-density-${timelineDensity} timeline-capacity-${timelineCapacity} timeline-stack-${timelineStack}${isDragging ? " is-dragging" : ""}`}>
      <QuestionModalHeader
        category={category || ""}
        typeLabel="Timeline"
        points={basePoints ?? points ?? 0}
        teamName={isComplete ? undefined : currentTeamName}
        teamColor={currentTeamColor}
        teamEmoji={currentTeamEmoji}
        teamLabel="Placing now"
      />

      <div className="question-modal-scroll timeline-modal-scroll">
        <section className="timeline-stage">
          <header className="timeline-intro">
            <div className="timeline-intro-copy">
              <span className="question-modal-eyebrow">Build the chronology</span>
              <h1>{title || "Place each event where it belongs"}</h1>
              <p>{instruction}</p>
            </div>
            <div className="timeline-progress" aria-label={`${placedCount} of ${totalCount} events placed`}>
              <strong>{placedCount}<span>/{totalCount}</span></strong>
              <small>events placed</small>
              <div aria-hidden><span style={{ width: `${totalCount ? (placedCount / totalCount) * 100 : 0}%` }} /></div>
            </div>
          </header>

          <section className={`timeline-live-scores${isComplete ? " final" : ""}${compactScores ? " compact-teams" : ""}`} aria-label="Current Timeline scores">
            <div className="timeline-live-score-label">
              <small>{isComplete ? "Final distribution" : "Timeline score"}</small>
              <strong>{distributedPoints}<span>/{potentialScore ?? points ?? 0}</span></strong>
            </div>
            <div className="timeline-live-score-teams">
              {scoreResults.map((result) => {
                const isAnswering = Boolean(activeEvent) && result.teamId === currentTeamId;
                return (
                <div
                  className={`timeline-live-score${isAnswering ? " is-answering" : ""}`}
                  key={result.teamId}
                  style={{ "--timeline-team-color": result.teamColor } as CSSProperties}
                  aria-current={isAnswering ? "true" : undefined}
                  title={isAnswering ? `${result.teamName} · Answering now` : compactScores ? result.teamName : undefined}
                >
                  <TeamPill name={result.teamName} color={result.teamColor} emoji={result.teamEmoji || "⭐️"} />
                  <small>
                    {result.correctCount} correct
                    {!compactScores && result.wrongCount > 0 ? ` · ${result.wrongCount} wrong` : ""}
                  </small>
                  <strong>{result.points}<span> pts</span></strong>
                </div>
                );
              })}
            </div>
          </section>

          <div className="timeline-board">
            <div className="timeline-direction" aria-hidden>
              <span>Earlier</span>
              <i />
              <span>Later</span>
            </div>
            <div className="timeline-track-scroll">
              <div className={`timeline-track density-${timelineDensity}${groups.length === 1 ? " is-starting" : ""}`}>
                {renderDropZone({ index: 0 }, "timeline-start")}
                {groups.map((group, groupIndex) => {
                  const hasCorrect = group.events.some((event) => event.status === "correct");
                  const hasWrong = group.events.some((event) => event.status === "wrong");
                  const status = hasCorrect ? "correct" : hasWrong ? "wrong" : "pending";
                  const nextIndex = group.startIndex + group.events.length;

                  return (
                    <div className="timeline-track-step" key={`${group.year}-${groupIndex}`}>
                      <div
                        className={`timeline-year-card side-${group.side} status-${status}`}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          setIsDragging(false);
                          if (!disableActions) onPlace({ index: group.startIndex, onYear: group.year });
                        }}
                      >
                        <strong className="timeline-year">{formatYear(group.year)}</strong>
                        <div className="timeline-year-events">
                          {group.events.map((event, eventIndex) => (
                            <div className={`timeline-year-event${event.status ? ` ${event.status}` : ""}`} key={`${event.id}-${eventIndex}`}>
                              {event.side === "center"
                                ? centerLabel || event.timelineText || "Center year"
                                : event.timelineText ?? event.text}
                              {event.status && <small>{event.status === "correct" ? "Correct" : "Wrong"}</small>}
                            </div>
                          ))}
                        </div>
                      </div>
                      {renderDropZone({ index: nextIndex }, `timeline-slot-${groupIndex}`)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className={`timeline-event-dock${activeEvent ? " has-event" : " complete"}`}>
        {activeEvent ? (
          <div
            className="timeline-active-event"
            draggable={!disableActions}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", activeEvent.id);
              event.dataTransfer.effectAllowed = "move";
              if (dragPreviewRef.current) {
                event.dataTransfer.setDragImage(dragPreviewRef.current, 24, 24);
              }
              setIsDragging(true);
            }}
            onDragEnd={() => setIsDragging(false)}
          >
            <span className="timeline-event-grip" aria-hidden>⠿</span>
            <div>
              <small>Place this event</small>
              <strong>{activeEvent.text || "(No description)"}</strong>
            </div>
            <span className="timeline-drag-cue">Drag to the timeline <b aria-hidden>↑</b></span>
          </div>
        ) : scoreResults.length > 0 ? (
          <div className="timeline-result winner">
            <span aria-hidden>✦</span>
            <strong>Timeline complete</strong>
            <b>{distributedPoints} points distributed</b>
          </div>
        ) : noWinner ? (
          <div className="timeline-result no-winner"><span aria-hidden>◇</span><strong>Timeline complete · no points awarded</strong></div>
        ) : (
          <div className="timeline-result"><span aria-hidden>✓</span><strong>All events placed</strong></div>
        )}
        {!activeEvent && (
          <button className="button primary timeline-close" type="button" onClick={onClose}>
            Close
          </button>
        )}
      </footer>

      {activeEvent && (
        <div ref={dragPreviewRef} className="timeline-drag-preview" aria-hidden>
          <span>⠿</span>
          <div>
            <small>Timeline event</small>
            <strong>{activeEvent.text || "(No description)"}</strong>
          </div>
        </div>
      )}
    </article>
  );
}
