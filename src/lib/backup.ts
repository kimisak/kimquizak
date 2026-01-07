import {
  LEGACY_QUESTION_STORAGE_KEY,
  LEGACY_TEAM_STORAGE_KEY,
  LEGACY_TURN_STATE_STORAGE_KEY,
  QUESTION_STORAGE_KEY,
  TEAM_STORAGE_KEY,
  TURN_STATE_STORAGE_KEY,
} from "@/lib/storage";
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  type AppSettings,
} from "@/lib/settings";
import type { Question, Team, TurnState } from "@/lib/types";

export type BackupPayload = {
  version: 2;
  exportedAt: string;
  teams: Team[];
  questions: Question[];
  turnState: TurnState;
  settings: AppSettings;
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
  const teams =
    readLocalStorage<Team[]>(TEAM_STORAGE_KEY, []).length > 0
      ? readLocalStorage<Team[]>(TEAM_STORAGE_KEY, [])
      : readLocalStorage<Team[]>(LEGACY_TEAM_STORAGE_KEY, []);
  const questions =
    readLocalStorage<Question[]>(QUESTION_STORAGE_KEY, []).length > 0
      ? readLocalStorage<Question[]>(QUESTION_STORAGE_KEY, [])
      : readLocalStorage<Question[]>(LEGACY_QUESTION_STORAGE_KEY, []);
  const turnState = readLocalStorage<TurnState>(TURN_STATE_STORAGE_KEY, fallbackTurnState);
  const legacyTurnState = readLocalStorage<TurnState>(
    LEGACY_TURN_STATE_STORAGE_KEY,
    fallbackTurnState,
  );

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    teams,
    questions,
    turnState:
      turnState.order.length > 0 || turnState.boardIndex > 0 || turnState.lyricsIndex > 0
        ? turnState
        : legacyTurnState,
    settings: readLocalStorage<AppSettings>(SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS),
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
  const payload = parsed as Partial<BackupPayload> & { version?: number };
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
    version: 2,
    exportedAt: payload.exportedAt ?? new Date().toISOString(),
    teams: payload.teams,
    questions: payload.questions,
    turnState,
    settings:
      payload.settings && typeof payload.settings === "object"
        ? { ...DEFAULT_SETTINGS, ...payload.settings }
        : DEFAULT_SETTINGS,
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
  window.localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify(payload.settings ?? DEFAULT_SETTINGS),
  );
  window.localStorage.removeItem(LEGACY_TEAM_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_QUESTION_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_TURN_STATE_STORAGE_KEY);
}
