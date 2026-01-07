'use client';

import { useRef, useState } from "react";
import {
  buildBackupPayload,
  parseBackupPayload,
  persistBackupToLocalStorage,
} from "@/lib/backup";
import {
  LEGACY_QUESTION_STORAGE_KEY,
  LEGACY_TEAM_STORAGE_KEY,
  LEGACY_TURN_STATE_STORAGE_KEY,
  QUESTION_STORAGE_KEY,
  TEAM_STORAGE_KEY,
  TURN_STATE_STORAGE_KEY,
} from "@/lib/storage";
import { SETTINGS_STORAGE_KEY } from "@/lib/settings";

type Tone = "muted" | "success" | "error";

export function StorageBackupPanel() {
  const [status, setStatus] = useState<string>("");
  const [tone, setTone] = useState<Tone>("muted");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateStatus = (message: string, nextTone: Tone = "muted") => {
    setStatus(message);
    setTone(nextTone);
  };

  const handleDownload = () => {
    try {
      const payload = buildBackupPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const safeTimestamp = payload.exportedAt.replace(/[:.]/g, "-");
      const link = document.createElement("a");
      link.href = url;
      link.download = `kimquizak-backup-${safeTimestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      updateStatus("Backup downloaded to JSON.", "success");
    } catch (err) {
      console.error("Failed to download backup", err);
      updateStatus("Could not create a backup file.", "error");
    }
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === "string" ? reader.result : "";
        const payload = parseBackupPayload(text);
        persistBackupToLocalStorage(payload);
        updateStatus("Backup loaded. Refreshing data...", "success");
        setTimeout(() => window.location.reload(), 350);
      } catch (err) {
        console.error("Failed to import backup", err);
        const message =
          err instanceof Error ? err.message : "Unable to import this backup.";
        updateStatus(message, "error");
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    if (typeof window === "undefined") return;
    const confirmed = window.confirm(
      "This will erase all local data (teams, questions, progress) stored in your browser. Continue?",
    );
    if (!confirmed) return;
    try {
      window.localStorage.removeItem(TEAM_STORAGE_KEY);
      window.localStorage.removeItem(QUESTION_STORAGE_KEY);
      window.localStorage.removeItem(TURN_STATE_STORAGE_KEY);
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_TEAM_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_QUESTION_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_TURN_STATE_STORAGE_KEY);
      updateStatus("Local data cleared. Reloading...", "success");
      setTimeout(() => window.location.reload(), 350);
    } catch (err) {
      console.error("Failed to clear storage", err);
      updateStatus("Could not clear local data.", "error");
    }
  };

  const handleLoadExample = async () => {
    try {
      const mod = await import("../../default_questions.json");
      const payloadRaw = (mod as any).default ?? mod;
      const payload = parseBackupPayload(JSON.stringify(payloadRaw));
      persistBackupToLocalStorage(payload);
      updateStatus("Example data loaded. Reloading...", "success");
      setTimeout(() => window.location.reload(), 350);
    } catch (err) {
      console.error("Failed to load example data", err);
      const message =
        err instanceof Error
          ? err.message
          : "Could not load example data from default_questions.json.";
      updateStatus(message, "error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div>
        <div style={{ fontWeight: 700, marginBottom: "4px" }}>
          Backup & restore
        </div>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Save everything in localStorage to a JSON file, or load from one to seed
          a new browser.
        </p>
      </div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button className="button secondary" type="button" onClick={handleDownload}>
          ⬇️ Download backup
        </button>
        <label className="button ghost" style={{ cursor: "pointer" }}>
          ⬆️ Upload backup
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          className="button ghost"
          type="button"
          onClick={handleClearAll}
          style={{ borderColor: "rgba(255, 99, 99, 0.4)", color: "#fca5a5" }}
        >
          🗑️ Clear local data
        </button>
        <button className="button secondary" type="button" onClick={handleLoadExample}>
          ✨ Add example data
        </button>
      </div>
      {status ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "10px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            background:
              tone === "error"
                ? "rgba(255, 99, 99, 0.1)"
                : tone === "success"
                  ? "rgba(86, 204, 157, 0.1)"
                  : "rgba(255, 255, 255, 0.04)",
            color: tone === "error" ? "#fca5a5" : "#e3e8f0",
          }}
        >
          {status}
        </div>
      ) : null}
    </div>
  );
}
