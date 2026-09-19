"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Question } from "@/lib/types";
import { readQuestions, writeQuestions } from "@/lib/questionStorage";

let saveFailureShown = false;

export function usePersistentQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const valueRef = useRef(questions);
  const updatedRef = useRef(false);
  const hydratedRef = useRef(false);

  const save = useCallback((next: Question[]) => {
    void writeQuestions(next).catch((error) => {
      console.error("Failed to save questions", error);
      if (!saveFailureShown) {
        saveFailureShown = true;
        window.alert("Questions could not be saved in this browser. Please free up browser storage, then retry an edit before leaving this page.");
      }
    });
  }, []);

  const update = useCallback<Dispatch<SetStateAction<Question[]>>>((action) => {
    updatedRef.current = true;
    const next = typeof action === "function" ? action(valueRef.current) : action;
    valueRef.current = next;
    setQuestions(next);
    if (hydratedRef.current) save(next);
  }, [save]);

  useEffect(() => {
    let active = true;
    void readQuestions().then((stored) => {
      if (!active) return;
      if (!updatedRef.current) {
        valueRef.current = stored;
        setQuestions(stored);
      }
      hydratedRef.current = true;
      setHydrated(true);
      if (updatedRef.current) save(valueRef.current);
    }).catch((error) => console.error("Failed to load questions", error));
    return () => { active = false; };
  }, [save]);

  useEffect(() => {
    const refresh = () => {
      void readQuestions().then((stored) => {
        valueRef.current = stored;
        setQuestions(stored);
      }).catch((error) => console.error("Failed to refresh questions", error));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "kimquizak_questions_v1" || event.key === "julebord_questions_v1") refresh();
    };
    // Same-tab writes already update this hook's state. Other tabs use BroadcastChannel.
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("kimquizak-questions") : null;
    channel?.addEventListener("message", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, []);

  return [questions, update, hydrated] as const;
}
