import { useEffect, useRef, useState } from "react";

export function usePersistentState<T>(
  key: string,
  initial: T,
  legacyKeys: string[] = [],
) {
  const skipBroadcastRef = useRef(false);
  const readStored = () => {
    if (typeof window === "undefined") return initial;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored) as T;
      }
      for (const legacyKey of legacyKeys) {
        const legacy = window.localStorage.getItem(legacyKey);
        if (legacy) {
          window.localStorage.setItem(key, legacy);
          return JSON.parse(legacy) as T;
        }
      }
    } catch (err) {
      console.error("Failed to read localStorage", err);
    }
    return initial;
  };

  const [value, setValue] = useState<T>(() => readStored());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      if (skipBroadcastRef.current) {
        skipBroadcastRef.current = false;
        return;
      }
      window.dispatchEvent(new CustomEvent("local-storage", { detail: { key } }));
    } catch (err) {
      console.error("Failed to write localStorage", err);
    }
  }, [key, value]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key && !legacyKeys.includes(event.key ?? "")) return;
      skipBroadcastRef.current = true;
      setValue(readStored());
    };
    const handleLocal = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (!detail?.key || (detail.key !== key && !legacyKeys.includes(detail.key))) {
        return;
      }
      skipBroadcastRef.current = true;
      setValue(readStored());
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("local-storage", handleLocal);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("local-storage", handleLocal);
    };
  }, [key, legacyKeys]);

  return [value, setValue] as const;
}
