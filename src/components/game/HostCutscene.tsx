'use client';

import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { formatHostLine, type HostScene } from "@/lib/hostScenes";
import { PlayerPill } from "./PlayerPill";
import { TeamEmoji } from "./TeamEmoji";
import styles from "./HostCutscene.module.css";

type Props = {
  scene: HostScene;
  step: number;
  names: { host: string; player: string; team: string };
  hostEmoji: string;
  playerEmoji: string;
  playerColor: string;
  onNext: () => void;
  onSkip: () => void;
};

export function HostCutscene({ scene, step, names, hostEmoji, playerEmoji, playerColor, onNext, onSkip }: Props) {
  const panel = useRef<HTMLElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const line = scene.lines[step];
  const expressions = line?.mood === "laughing"
    ? { host: "😂", player: "😁" }
    : line?.speaker === "host"
      ? { host: "😃", player: "🤔" }
      : { host: "🤨", player: "😃" };
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    nextButton.current?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  const handleKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); onSkip(); }
    if (event.key !== "Tab") return;
    const buttons = panel.current?.querySelectorAll<HTMLButtonElement>('button');
    if (!buttons?.length) return;
    if (event.shiftKey && document.activeElement === buttons[0]) {
      event.preventDefault(); buttons[buttons.length - 1].focus();
    } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
      event.preventDefault(); buttons[0].focus();
    }
  };
  return createPortal(
    <div className={styles.overlay} onKeyDown={handleKey}>
      <section ref={panel} className={styles.scene} role="dialog" aria-modal="true" aria-labelledby="host-scene-title">
        <header className={styles.header}>
          <span className={styles.kicker}>BACKSTAGE · HOST BOOTH</span>
          <h2 id="host-scene-title">{scene.title}</h2>
          <div className={styles.progress} aria-label={`Scene beat ${step + 1} of ${scene.lines.length + 1}`}>
            {Array.from({ length: scene.lines.length + 1 }, (_, index) => <i key={index} className={index <= step ? styles.filled : undefined} />)}
          </div>
        </header>
        <div className={styles.stage}>
          <div className={`${styles.actor} ${line?.speaker === 'host' ? styles.speaking : ''}`}>
            <ul className={styles.pills}>
              <PlayerPill name={names.host} marker={hostEmoji} mood={expressions.host} />
            </ul>
            <small>HOST</small>
          </div>
          <span className={styles.stageMark} aria-hidden>✦</span>
          <div className={`${styles.actor} ${line?.speaker === 'player' ? styles.speaking : ''}`}>
            <ul className={styles.pills}>
              <PlayerPill name={names.player} marker={<TeamEmoji emoji={playerEmoji} color={playerColor} />} mood={expressions.player} style={{ "--team-base": playerColor } as CSSProperties} />
            </ul>
            <small>{names.team}</small>
          </div>
        </div>
        <div className={`${styles.bubble} ${line?.speaker === 'player' ? styles.playerBubble : ''} ${!line ? styles.ending : ''}`} aria-live="polite" aria-atomic="true">
          <span>{line ? names[line.speaker] : '🎬'}</span>
          <p key={step}>{formatHostLine(line?.text ?? scene.ending, names)}</p>
        </div>
        <footer className={styles.actions}>
          <button type="button" className={styles.skip} onClick={onSkip}>Skip scene</button>
          <button ref={nextButton} type="button" className={styles.next} onClick={onNext}>{line ? 'Next line →' : 'Back to the team →'}</button>
        </footer>
      </section>
    </div>, document.body,
  );
}
