import {
  QUESTION_STORAGE_KEY,
  TEAM_STORAGE_KEY,
  TURN_STATE_STORAGE_KEY,
} from "@/lib/storage";
import type { Question, Team, TurnState } from "@/lib/types";

export type BackupPayload = {
  version: 1;
  exportedAt: string;
  teams: Team[];
  questions: Question[];
  turnState: TurnState;
};

const fallbackTurnState: TurnState = {
  order: [],
  boardIndex: 0,
  lyricsIndex: 0,
};

function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Failed to read ${key} from localStorage`, err);
    return fallback;
  }
}

export function buildBackupPayload(): BackupPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    teams: readLocalStorage<Team[]>(TEAM_STORAGE_KEY, []),
    questions: readLocalStorage<Question[]>(QUESTION_STORAGE_KEY, []),
    turnState: readLocalStorage<TurnState>(TURN_STATE_STORAGE_KEY, fallbackTurnState),
  };
}

export function parseBackupPayload(raw: string): BackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("File is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Backup format is invalid.");
  }
  const payload = parsed as Partial<BackupPayload>;
  if (!Array.isArray(payload.teams)) {
    throw new Error("Backup is missing teams.");
  }
  if (!Array.isArray(payload.questions)) {
    throw new Error("Backup is missing questions.");
  }
  const turnState =
    payload.turnState && typeof payload.turnState === "object"
      ? {
          ...fallbackTurnState,
          ...payload.turnState,
        }
      : fallbackTurnState;

  return {
    version: 1,
    exportedAt: payload.exportedAt ?? new Date().toISOString(),
    teams: payload.teams,
    questions: payload.questions,
    turnState,
  };
}

export function persistBackupToLocalStorage(payload: BackupPayload) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(payload.teams ?? []));
  window.localStorage.setItem(
    QUESTION_STORAGE_KEY,
    JSON.stringify(payload.questions ?? []),
  );
  window.localStorage.setItem(
    TURN_STATE_STORAGE_KEY,
    JSON.stringify(payload.turnState ?? fallbackTurnState),
  );
}
