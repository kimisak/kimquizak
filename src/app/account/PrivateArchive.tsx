"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buildBackupPayload, parseBackupPayload, persistBackupToLocalStorage } from "@/lib/backup";

type Snapshot = { id: string; title: string; created_at: string };

async function checkResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request failed.");
  return data;
}

export function PrivateArchive() {
  const [quizzes, setQuizzes] = useState<Snapshot[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  async function refresh() {
    const data = await checkResponse(await fetch("/api/quizzes", { cache: "no-store" }));
    setQuizzes(data.quizzes);
    setReady(true);
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/quizzes", { cache: "no-store", signal: controller.signal })
      .then(checkResponse).then(data => { setQuizzes(data.quizzes); setReady(true); })
      .catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, []);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const body = JSON.stringify(await buildBackupPayload());
      if (new Blob([body]).size > 3_000_000) throw new Error("This quiz exceeds the 3 MB cloud limit. Use a local JSON backup instead.");
      await checkResponse(await fetch("/api/quizzes", { method: "POST", headers: { "Content-Type": "application/json" }, body }));
      setMessage("Private copy saved.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save quiz.");
    } finally { setBusy(false); }
  }

  async function download(id: string) {
    setBusy(true);
    try {
      const payload = await checkResponse(await fetch(`/api/quizzes?id=${id}`, { cache: "no-store" }));
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `kimquizak-backup-${id}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Downloaded. Use Upload backup in the local archive to open this quiz.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not download quiz.");
    } finally { setBusy(false); }
  }

  async function remove(quiz: Snapshot) {
    if (!window.confirm(`Permanently delete “${quiz.title}” saved ${new Date(quiz.created_at).toLocaleString()}? This removes the cloud copy. Your browser’s current quiz and downloaded backups are kept.`)) return;
    setBusy(true);
    setMessage("");
    try {
      await checkResponse(await fetch(`/api/quizzes?id=${quiz.id}`, { method: "DELETE" }));
      setQuizzes(current => current.filter(item => item.id !== quiz.id));
      setMessage("Saved cloud copy deleted.");
      try { await refresh(); } catch {
        setMessage("Saved cloud copy deleted. Refresh the page to reload the remaining copies.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete quiz.");
    } finally { setBusy(false); }
  }

  async function openInEditor(quiz: Snapshot) {
    if (!window.confirm(`Open “${quiz.title}” saved ${new Date(quiz.created_at).toLocaleString()}? This replaces this browser’s current teams, questions, settings, scores, and game progress. Save the current quiz first if you want to keep it.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const data = await checkResponse(await fetch(`/api/quizzes?id=${quiz.id}`, { cache: "no-store" }));
      const payload = parseBackupPayload(JSON.stringify(data));
      await persistBackupToLocalStorage(payload);
      // Reload the app so mounted settings/header state reads the restored quiz.
      window.location.assign("/config/questions");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open quiz.");
      setBusy(false);
    }
  }

  return <section>
    <button className="button primary" disabled={busy} onClick={save}>{busy ? "Working…" : "Save this browser’s quiz privately"}</button>
    <p role="status">{message}</p>
    {ready && quizzes.length === 0 && <p>No saved quizzes yet.</p>}
    <ul className="private-quiz-list">{quizzes.map(quiz => <li key={quiz.id}>
      <div><strong>{quiz.title}</strong><br /><small>{new Date(quiz.created_at).toLocaleString()}</small></div>
      <div className="archive-actions">
        <button className="button primary" disabled={busy} onClick={() => openInEditor(quiz)}>Open in editor</button>
        <button className="button secondary" disabled={busy} onClick={() => download(quiz.id)}>Download backup</button>
        <button className="button archive-danger" disabled={busy} onClick={() => remove(quiz)} aria-label={`Delete saved copy of ${quiz.title}`}>Delete</button>
      </div>
    </li>)}</ul>
    <p>Showing your latest 100 copies. Each save creates a new copy, up to 3 MB. Larger quizzes can use local JSON backups.</p>
    <Link href="/config/questions">Open the editor and local archive →</Link>
  </section>;
}
