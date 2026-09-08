import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

export function usePersistentState<T>(
  key: string,
  initial: T,
  legacyKeys: string[] = [],
) {
  const skipBroadcastRef = useRef(false);
  const locallyUpdatedRef = useRef(false);
  const hydrationCommittedRef = useRef(false);
  const initialRef = useRef(initial);
  const legacyKeySignature = legacyKeys.join("\u0000");
  const stableLegacyKeys = useMemo(
    () => (legacyKeySignature ? legacyKeySignature.split("\u0000") : []),
    [legacyKeySignature],
  );

  const readStored = useCallback((): { value: T; found: boolean } => {
    if (typeof window === "undefined") {
      return { value: initialRef.current, found: false };
    }
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        return { value: JSON.parse(stored) as T, found: true };
      }
      for (const legacyKey of stableLegacyKeys) {
        const legacy = window.localStorage.getItem(legacyKey);
        if (legacy) {
          window.localStorage.setItem(key, legacy);
          return { value: JSON.parse(legacy) as T, found: true };
        }
      }
    } catch (err) {
      console.error("Failed to read localStorage", err);
    }
    return { value: initialRef.current, found: false };
  }, [key, stableLegacyKeys]);

  // The server and the browser's first render must use the same snapshot.
  // Browser storage is applied after hydration, before persistence is enabled.
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const valueRef = useRef(value);
  const persistValue = useCallback((nextValue: T, broadcast = true) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(nextValue));
      if (broadcast) {
        window.dispatchEvent(new CustomEvent("local-storage", { detail: { key } }));
      }
    } catch (err) {
      console.error("Failed to write localStorage", err);
    }
  }, [key]);
  const setPersistentValue = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    locallyUpdatedRef.current = true;
    const nextValue = typeof next === "function"
      ? (next as (previous: T) => T)(valueRef.current)
      : next;
    valueRef.current = nextValue;
    setValue(nextValue);
    if (hydrationCommittedRef.current) persistValue(nextValue);
  }, [persistValue]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const stored = readStored();
      setValue((current) =>
        stored.found || !locallyUpdatedRef.current ? stored.value : current,
      );
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [readStored]);

  useEffect(() => {
    hydrationCommittedRef.current = hydrated;
  }, [hydrated]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (typeof window === "undefined" || !hydrated) return;
    const shouldBroadcast = !skipBroadcastRef.current;
    skipBroadcastRef.current = false;
    persistValue(value, shouldBroadcast);
  }, [hydrated, persistValue, value]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key && !stableLegacyKeys.includes(event.key ?? "")) return;
      skipBroadcastRef.current = true;
      setValue(readStored().value);
    };
    const handleLocal = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (!detail?.key || (detail.key !== key && !stableLegacyKeys.includes(detail.key))) {
        return;
      }
      skipBroadcastRef.current = true;
      setValue(readStored().value);
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("local-storage", handleLocal);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("local-storage", handleLocal);
    };
  }, [key, readStored, stableLegacyKeys]);

  return [value, setPersistentValue, hydrated] as const;
}
