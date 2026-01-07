'use client';

import { usePersistentState } from "@/hooks/usePersistentState";
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  type AppSettings,
} from "@/lib/settings";

export function useSettings() {
  return usePersistentState<AppSettings>(
    SETTINGS_STORAGE_KEY,
    DEFAULT_SETTINGS,
  );
}
