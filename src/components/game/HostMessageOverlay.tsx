'use client';

import { useLayoutEffect, useRef, useState } from "react";
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
  const innerRef = useRef<HTMLSpanElement>(null);
  const characterCount = resolution.text.trim().length;
  const lineCount = resolution.text.split("\n").length;
  const hasPlayerGroup = /\{(?:males|females)\}/i.test(message.text);
  const sizeClass = characterCount <= 36 && lineCount <= 2
    ? " host-message-copy-hero"
    : characterCount <= 90 && lineCount <= 3
      ? " host-message-copy-large"
      : characterCount <= 180
        ? " host-message-copy-medium"
        : " host-message-copy-long";

  useLayoutEffect(() => {
    const copy = copyRef.current;
    const inner = innerRef.current;
    if (!copy || !inner) return;
    let animationFrame = 0;

    const fit = () => {
      copy.style.removeProperty("font-size");
      const maximum = Number.parseFloat(window.getComputedStyle(copy).fontSize);
      let lower = hasPlayerGroup ? 16 : 28;
      let upper = Math.max(lower, maximum);

      for (let iteration = 0; iteration < 9; iteration += 1) {
        const candidate = (lower + upper) / 2;
        copy.style.fontSize = `${candidate}px`;
        const fits = inner.scrollHeight <= copy.clientHeight + 2
          && inner.scrollWidth <= copy.clientWidth + 2;
        if (fits) lower = candidate;
        else upper = candidate;
      }
      copy.style.fontSize = `${lower}px`;
    };
    const scheduleFit = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(fit);
    };
    const resizeObserver = new ResizeObserver(scheduleFit);
    resizeObserver.observe(copy);
    const contentObserver = new MutationObserver(scheduleFit);
    contentObserver.observe(inner, { childList: true, characterData: true, subtree: true });
    scheduleFit();
    void document.fonts?.ready.then(scheduleFit);

    return () => {
      resizeObserver.disconnect();
      contentObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [hasPlayerGroup, message.text, resolution.text, teams]);

  return (
    <p id="host-message-copy" className={`host-message-copy${sizeClass}`} ref={copyRef}>
      <span className="host-message-copy-inner" ref={innerRef}>
        <HostMessageRichText template={message.text} resolution={resolution} teams={teams} countdownsActive />
      </span>
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
  const wheelCanRepresentEverySelection = randomSelections.every(
    (selection) => selection.kind !== "number" || selection.candidates.length > 0,
  );
  const effectiveRevealStyle = wheelCanRepresentEverySelection ? revealStyle : "direct";
  const allWheelSelectionsResolved = randomSelections.every(
    (selection) => selection.physicsVersion === 2,
  );
  const [revealComplete, setRevealComplete] = useState(
    effectiveRevealStyle === "direct" || randomSelections.length === 0 || allWheelSelectionsResolved,
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
      {!revealComplete && effectiveRevealStyle !== "direct" ? (
        <RandomRevealSequence
          selections={randomSelections}
          teams={teams}
          onSelectionsChange={updateRandomSelections}
          onFinish={() => setRevealComplete(true)}
        />
      ) : <section className="host-message-stage host-message-copy-stage">
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
