import { usePersistentState } from "@/hooks/usePersistentState";
import { DEFAULT_HOST_PROFILE } from "@/lib/hostProfile";
import { HOST_PROFILE_STORAGE_KEY } from "@/lib/storage";
import type { HostProfile } from "@/lib/types";

export function useHostProfile() {
  return usePersistentState<HostProfile>(HOST_PROFILE_STORAGE_KEY, DEFAULT_HOST_PROFILE);
}
