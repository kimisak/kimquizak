'use client';

import { usePersistentState } from "@/hooks/usePersistentState";
import { TURN_STATE_STORAGE_KEY } from "@/lib/storage";
import type { TurnState } from "@/lib/types";

export function useTurnState() {
  const [turnState, setTurnState] = usePersistentState<TurnState>(
    TURN_STATE_STORAGE_KEY,
    {
      order: [],
      boardIndex: 0,
      lyricsIndex: 0,
    },
  );

  const setOrder = (order: string[]) =>
    setTurnState({
      order,
      boardIndex: 0,
      lyricsIndex: 0,
    });

  const advanceBoard = () =>
    setTurnState((prev) => {
      if (!prev.order.length) return prev;
      const len = prev.order.length;
      return { ...prev, boardIndex: (prev.boardIndex + 1) % len };
    });

  const advanceLyrics = () =>
    setTurnState((prev) => {
      if (!prev.order.length) return prev;
      const len = prev.order.length;
      return { ...prev, lyricsIndex: (prev.lyricsIndex + 1) % len };
    });

  const reset = () =>
    setTurnState({
      order: [],
      boardIndex: 0,
      lyricsIndex: 0,
    });

  return { turnState, setTurnState, setOrder, advanceBoard, advanceLyrics, reset };
}
