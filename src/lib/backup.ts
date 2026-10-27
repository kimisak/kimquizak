import {
  LEGACY_QUESTION_STORAGE_KEY,
  LEGACY_TEAM_STORAGE_KEY,
  LEGACY_TURN_STATE_STORAGE_KEY,
  HOST_PROFILE_STORAGE_KEY,
  SCORE_HISTORY_STORAGE_KEY,
  TEAM_STORAGE_KEY,
  TURN_STATE_STORAGE_KEY,
} from "@/lib/storage";
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  type AppSettings,
} from "@/lib/settings";
import { DEFAULT_HOST_PROFILE, normalizeHostProfile } from "@/lib/hostProfile";
import type { HostProfile, Question, ScoreTransaction, Team, TurnState } from "@/lib/types";
import { readQuestions, writeQuestions } from "@/lib/questionStorage";

export type BackupPayload = {
  version: 3;
  exportedAt: string;
  teams: Team[];
  questions: Question[];
  turnState: TurnState;
  settings: AppSettings;
  scoreHistory: ScoreTransaction[];
  hostProfile: HostProfile;
};

const fallbackTurnState: TurnState = {
  order: [],
  boardIndex: 0,
  lyricsIndex: 0,
  revealedCategories: [],
  dismissedHostMessageIds: [],
  resolvedHostMessages: {},
  audioPlaybackCounts: {},
  audioReplayValues: {},
  scoresHidden: false,
  hiddenScoreOrder: [],
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

function withSettingsDefaults(settings: Partial<AppSettings>): AppSettings {
  const finaleMusicStartSeconds = settings.finaleMusicStartSeconds
    ?? DEFAULT_SETTINGS.finaleMusicStartSeconds;
  const finaleMusicEndSeconds = settings.finaleMusicEndSeconds
    ?? (finaleMusicStartSeconds + (
      settings.finaleMusicDurationSeconds
      ?? (DEFAULT_SETTINGS.finaleMusicEndSeconds - DEFAULT_SETTINGS.finaleMusicStartSeconds)
    ));
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    finaleMusicStartSeconds,
    finaleMusicEndSeconds,
  };
}

export async function buildBackupPayload(): Promise<BackupPayload> {
  const teams = readLocalStorage<Team[] | null>(TEAM_STORAGE_KEY, null)
    ?? readLocalStorage<Team[]>(LEGACY_TEAM_STORAGE_KEY, []);
  const questions = await readQuestions();
  const turnState = readLocalStorage<TurnState | null>(TURN_STATE_STORAGE_KEY, null);
  const legacyTurnState = readLocalStorage<TurnState>(
    LEGACY_TURN_STATE_STORAGE_KEY,
    fallbackTurnState,
  );

  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    teams,
    questions,
    turnState: turnState ?? legacyTurnState,
    settings: withSettingsDefaults(
      readLocalStorage<Partial<AppSettings>>(SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS),
    ),
    scoreHistory: readLocalStorage<ScoreTransaction[]>(SCORE_HISTORY_STORAGE_KEY, []),
    hostProfile: normalizeHostProfile(
      readLocalStorage<HostProfile>(HOST_PROFILE_STORAGE_KEY, DEFAULT_HOST_PROFILE),
      new Set(teams.flatMap((team) => team.players.map((player) => player.id))),
    ),
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
    version: 3,
    exportedAt: payload.exportedAt ?? new Date().toISOString(),
    teams: payload.teams,
    questions: payload.questions,
    turnState,
    settings:
      payload.settings && typeof payload.settings === "object"
        ? withSettingsDefaults(payload.settings)
        : DEFAULT_SETTINGS,
    scoreHistory: Array.isArray(payload.scoreHistory) ? payload.scoreHistory : [],
    hostProfile: normalizeHostProfile(
      payload.hostProfile,
      new Set(payload.teams.flatMap((team) => team.players.map((player) => player.id))),
    ),
  };
}

export async function persistBackupToLocalStorage(payload: BackupPayload) {
  if (typeof window === "undefined") return;
  await writeQuestions(payload.questions ?? []);
  window.localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(payload.teams ?? []));
  window.localStorage.setItem(
    TURN_STATE_STORAGE_KEY,
    JSON.stringify(payload.turnState ?? fallbackTurnState),
  );
  window.localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify(payload.settings ?? DEFAULT_SETTINGS),
  );
  window.localStorage.setItem(
    SCORE_HISTORY_STORAGE_KEY,
    JSON.stringify(payload.scoreHistory ?? []),
  );
  window.localStorage.setItem(
    HOST_PROFILE_STORAGE_KEY,
    JSON.stringify(normalizeHostProfile(
      payload.hostProfile,
      new Set((payload.teams ?? []).flatMap((team) => team.players.map((player) => player.id))),
    )),
  );
  window.localStorage.removeItem(LEGACY_TEAM_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_QUESTION_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_TURN_STATE_STORAGE_KEY);
}
