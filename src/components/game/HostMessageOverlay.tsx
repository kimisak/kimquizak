'use client';

import { useEffect, useRef, useState } from "react";
import { HostMessageRichText } from "@/components/game/HostMessageRichText";
import { RandomRevealSequence } from "@/components/game/RandomRevealSequence";
import type { HostMessage } from "@/lib/settings";
import type { ResolvedHostMessage, Team } from "@/lib/types";

type Props = {
  message: HostMessage;
  resolution: ResolvedHostMessage;
  teams: Team[];
  answeredQuestionCount: number;
  playableQuestionCount: number;
  onResolutionChange?: (resolution: ResolvedHostMessage) => void;
  onDismiss: () => void;
};

function FittedHostMessage({
  message,
  resolution,
  teams,
}: {
  message: HostMessage;
  resolution: ResolvedHostMessage;
  teams: Team[];
}) {
  const copyRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const copy = copyRef.current;
    if (!copy) return;
    let animationFrame = 0;

    const fit = () => {
      copy.style.removeProperty("font-size");
      let fontSize = Number.parseFloat(window.getComputedStyle(copy).fontSize);
      while (
        fontSize > 16
        && (copy.scrollWidth > copy.clientWidth + 1 || copy.scrollHeight > copy.clientHeight + 1)
      ) {
        fontSize -= 1;
        copy.style.fontSize = `${fontSize}px`;
      }
    };
    const scheduleFit = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(fit);
    };

    scheduleFit();
    window.addEventListener("resize", scheduleFit);
    return () => {
      window.removeEventListener("resize", scheduleFit);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [message.text, resolution, teams]);

  return (
    <p id="host-message-copy" ref={copyRef}>
      <HostMessageRichText template={message.text} resolution={resolution} teams={teams} />
    </p>
  );
}

export function HostMessageOverlay({
  message,
  resolution,
  teams,
  answeredQuestionCount,
  playableQuestionCount,
  onResolutionChange,
  onDismiss,
}: Props) {
  const revealStyle = message.revealStyle === "direct" ? "direct" : "spin-wheel";
  const [liveResolution, setLiveResolution] = useState(resolution);
  const liveResolutionRef = useRef(resolution);
  const randomSelections = liveResolution.randomSelections ?? [];
  const allWheelSelectionsResolved = randomSelections.every(
    (selection) => selection.physicsVersion === 2,
  );
  const [revealComplete, setRevealComplete] = useState(
    revealStyle === "direct" || randomSelections.length === 0 || allWheelSelectionsResolved,
  );

  const updateRandomSelections = (nextSelections: typeof randomSelections) => {
    const next = { ...liveResolutionRef.current, randomSelections: nextSelections };
    liveResolutionRef.current = next;
    setLiveResolution(next);
    onResolutionChange?.(next);
  };

  return (
    <div
      className="host-message-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="host-message-title"
      aria-describedby="host-message-copy"
    >
      {!revealComplete && revealStyle !== "direct" ? (
        <RandomRevealSequence
          selections={randomSelections}
          teams={teams}
          onSelectionsChange={updateRandomSelections}
          onFinish={() => setRevealComplete(true)}
        />
      ) : <section className="host-message-stage">
        <span className="host-message-kicker">A message from the host</span>
        <span className="host-message-progress">
          {answeredQuestionCount} of {playableQuestionCount} questions played
        </span>
        <div className="host-message-ornament" aria-hidden>✦</div>
        <h1 id="host-message-title">Pause the board</h1>
        <FittedHostMessage message={message} resolution={liveResolution} teams={teams} />
        <button className="button host-message-dismiss" type="button" onClick={onDismiss} autoFocus>
          Continue the game
        </button>
        <small>Scheduled after question {message.afterQuestionCount} · dismissed by the host</small>
      </section>}
    </div>
  );
}
