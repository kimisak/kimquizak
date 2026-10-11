'use client';

import type { Question, TriviaItem } from "@/lib/types";
import { makeId } from "@/lib/defaultData";
import { useLayoutEffect, useRef } from "react";

export function TriviaFields({ question, onChange }: { question: Question; onChange: (patch: Partial<Question>) => void }) {
  const items = question.triviaItems ?? [];
  const latest = useRef({ items, onChange });
  useLayoutEffect(() => { latest.current = { items: question.triviaItems ?? [], onChange }; }, [question.triviaItems, onChange]);
  const update = (id: string, patch: Partial<TriviaItem>) => latest.current.onChange({ triviaItems: latest.current.items.map(item => item.id === id ? { ...item, ...patch } : item) });
  const move = (index: number, direction: number) => {
    const next = [...items];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange({ triviaItems: next });
  };
  return <section className="trivia-config">
    <label className="label">Round title (optional)<input className="input" value={question.prompt} placeholder="The Christmas round" onChange={e => onChange({ prompt: e.target.value })} /></label>
    <p className="muted">All teams answer on paper. Each team can earn the full {question.points} points. Questions carry equal weight; totals are rounded once. No penalties or rollover.</p>
    {items.map((item, index) => <section className="trivia-config-item" key={item.id} aria-label={`Trivia question ${index + 1}`}>
      <header><strong>Question {index + 1}</strong><div>
        <button type="button" className="button ghost" disabled={index === 0} aria-label={`Move question ${index + 1} up`} onClick={() => move(index, -1)}>↑</button>
        <button type="button" className="button ghost" disabled={index === items.length - 1} aria-label={`Move question ${index + 1} down`} onClick={() => move(index, 1)}>↓</button>
        <button type="button" className="button ghost" aria-label={`Remove question ${index + 1}`} onClick={() => {
          if ((item.prompt || item.answer || item.imageData) && !window.confirm("Remove this question from the round?")) return;
          onChange({ triviaItems: items.filter(candidate => candidate.id !== item.id) });
        }}>×</button>
      </div></header>
      <label className="label">Question<textarea aria-label="Question" className="input" value={item.prompt} onChange={e => update(item.id, { prompt: e.target.value })} /></label>
      <label className="label">Answer<textarea aria-label="Answer" className="input" value={item.answer} onChange={e => update(item.id, { answer: e.target.value })} /></label>
      <label className="label">Image (optional)<input className="input" type="file" accept="image/*" onChange={async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { alert("Please use an image under 3 MB."); return; }
        const reader = new FileReader();
        reader.onload = () => update(item.id, { imageData: String(reader.result), imageName: file.name });
        reader.readAsDataURL(file);
      }} /></label>
      {item.imageData && <div className="trivia-config-image"><img src={item.imageData} alt={item.imageName || "Question image"} /><button type="button" className="button ghost" onClick={() => update(item.id, { imageData: null, imageName: null })}>Remove image</button></div>}
    </section>)}
    <button type="button" className="button" onClick={() => onChange({ triviaItems: [...items, { id: makeId("trivia"), prompt: "", answer: "" }] })}>Add question to round</button>
  </section>;
}
