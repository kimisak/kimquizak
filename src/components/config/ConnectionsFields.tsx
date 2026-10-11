'use client';

import { useLayoutEffect, useRef } from "react";
import type { Question } from "@/lib/types";
import { connectionsGuessSeconds, connectionsMistakeLimit, connectionsRequired, formatConnectionsText, parseConnectionsText } from "@/lib/connections";

export function ConnectionsFields({ question, onChange }: { question: Question; onChange: (patch: Partial<Question>) => void }) {
  const text = question.connectionsText ?? formatConnectionsText(question.connectionsGroups ?? [], question.connectionsFiller ?? []);
  const input = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    const resize = () => {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight + 2}px`;
    };
    resize();
    let width = element.parentElement?.clientWidth;
    const observer = new ResizeObserver(() => {
      const next = element.parentElement?.clientWidth;
      if (next !== width) { width = next; resize(); }
    });
    // Observe the parent so wrapping changes also resize the textarea.
    if (element.parentElement) observer.observe(element.parentElement);
    return () => observer.disconnect();
  }, [text]);
  return <section className="connections-config">
    <label className="label">Round title (optional)<input className="input" value={question.prompt} placeholder="Find the connections" onChange={event => onChange({ prompt: event.target.value })} /></label>
    <p className="muted">Create four real groups of four words or short phrases. Players see shuffled tiles and select four that belong together. The {question.points} points are split across {connectionsRequired(question)} required connections; earned points are always kept.</p>
    <label className="label">Connections
      <textarea ref={input} className="input connections-text-input" aria-label="Connections puzzle" rows={6} value={text}
        placeholder={'Things you can fold: Paper, Laundry, Arms, Poker hand\nInstruments: Piano, Flute, Drums, Violin\nWeather: Rain, Snow, Hail, Fog\nColours: Red, Blue, Green, Yellow'}
        onChange={event => {
          const connectionsText = event.target.value;
          const parsed = parseConnectionsText(connectionsText);
          onChange({ connectionsText, connectionsGroups: parsed.groups, connectionsFiller: undefined });
        }} />
      <small>One connection per line: <code>Connection: tile 1, tile 2, tile 3, tile 4</code>. Use four connection lines and 16 unique tiles in total. Put text containing a comma or colon in double quotes.</small>
    </label>
    <label className="label">Connections needed to finish
      <select className="input" aria-label="Connections needed to finish" value={connectionsRequired(question)} onChange={event => onChange({ connectionsRequired: Number(event.target.value) })}>
        {[1, 2, 3, 4].map(count => <option key={count} value={count}>{count}{count === 4 ? " (all)" : " of 4"}</option>)}
      </select>
      <small>Find any {connectionsRequired(question)} of the four connections. Remaining answers are revealed when the round ends and award no extra points.</small>
    </label>
    <div className="connections-config-words">
      <label className="label">Seconds per guess<input type="number" className="input" min={0} max={3600} value={connectionsGuessSeconds(question)} onChange={event => onChange({ connectionsGuessSeconds: Number(event.target.value) })} /><small>0 disables the timer. A timeout counts as a mistake. Each new guess gets a fresh timer.</small></label>
      <label className="label">Shared mistake limit<input type="number" className="input" min={0} max={100} value={connectionsMistakeLimit(question)} onChange={event => onChange({ connectionsMistakeLimit: Number(event.target.value) })} /><small>0 allows unlimited mistakes.</small></label>
    </div>
    <label className="label connections-rollover"><span><input type="checkbox" checked={question.connectionsRotateOnMiss !== false} onChange={event => onChange({ connectionsRotateOnMiss: event.target.checked })} /> Rollover after a wrong guess or timeout</span><small>{question.connectionsRotateOnMiss !== false ? "Correct groups keep the turn. Mistakes pass to the next team." : "The same team plays until the finish target or mistake limit is reached."}</small></label>
    <p className="connections-pacing-note">Plan this as a longer game round. The timer is per guess, not for the whole round. The host can end the round at any time; there is no limit on how many Connections rounds you add to the board.</p>
  </section>;
}
