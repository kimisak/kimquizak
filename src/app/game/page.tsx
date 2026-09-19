'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BoardGrid } from "@/components/game/BoardGrid";
import { FinalCelebration } from "@/components/game/FinalCelebration";
import { HostMessageOverlay } from "@/components/game/HostMessageOverlay";
import { Leaderboard } from "@/components/game/Leaderboard";
import { GeoguesserModal } from "@/components/game/modals/GeoguesserModal";
import {
  JokerModal,
  type JokerProgress,
  type JokerRound,
} from "@/components/game/modals/JokerModal";
import { McqModal } from "@/components/game/modals/McqModal";
import { TimelineModal } from "@/components/game/modals/TimelineModal";
import { LyricsModal } from "@/components/game/modals/LyricsModal";
import { StandardModal } from "@/components/game/modals/StandardModal";
import { AudioModal } from "@/components/game/modals/AudioModal";
import { BoobyModal } from "@/components/game/modals/BoobyModal";
import { TurnOrderRail } from "@/components/game/TurnOrderRail";
import { useAudioCue } from "@/hooks/useAudioCue";
import { useFinaleSoundtrack } from "@/hooks/useFinaleSoundtrack";
import { usePersistentState } from "@/hooks/usePersistentState";
import { usePersistentQuestions } from "@/hooks/usePersistentQuestions";
import { useSettings } from "@/hooks/useSettings";
import { useTurnState } from "@/hooks/useTurnState";
import { generateRedPattern, shuffle } from "@/lib/redPattern";
import {
  LEGACY_TEAM_STORAGE_KEY,
  SCORE_HISTORY_STORAGE_KEY,
  TEAM_STORAGE_KEY,
} from "@/lib/storage";
import { type Question, type ScoreTransaction, type Team, type TimelineEvent } from "@/lib/types";
import { buildDefaultTeams, makeId } from "@/lib/defaultData";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { resolveHostMessageTemplate } from "@/lib/hostMessageTemplates";
import { isQuestionReady } from "@/lib/questionValidation";
import { getTeamAccent, reconcileTeamTheme } from "@/lib/teamPresentation";
import { allocateTimelinePoints, type TimelinePlacementOutcome } from "@/lib/timelineScoring";
import { getAudioAvailablePoints } from "@/lib/audioScoring";
import { getGeoExploreValue } from "@/lib/geoguesser";
import { getVisibleBoardQuestions } from "@/lib/boardReveal";

type ActiveQuestion = Question & { category: string };
type PlacedTimelineEvent = TimelineEvent & {
  status?: "correct" | "wrong";
};
type TimelineScoreResult = {
  teamId: string;
  teamName: string;
  teamColor: string;
  teamEmoji?: string | null;
  correctCount: number;
  sharedMissCount: number;
  points: number;
};

export default function GameBoardPage() {
  const [settings] = useSettings();
  const {
    playSadBlip,
    playCountdownBeep,
    playFinalAlarm,
    playSuccessChime,
    playDownbeat,
    playBigWin,
    playSlotResolve,
    playJokerSparkle,
    startSlotSpinLoop,
    stopSlotSpinLoop,
    startFinaleDrumroll,
    stopFinaleDrumroll,
  } = useAudioCue();
  const [teams, setTeams] = usePersistentState<Team[]>(
    TEAM_STORAGE_KEY,
    [],
    [LEGACY_TEAM_STORAGE_KEY],
  );
  const [questions, setQuestions] = usePersistentQuestions();
  const [scoreHistory, setScoreHistory] = usePersistentState<ScoreTransaction[]>(
    SCORE_HISTORY_STORAGE_KEY,
    [],
  );
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(
    null,
  );
  const [lyricsRevealed, setLyricsRevealed] = useState<boolean[]>([]);
  const [lyricsPattern, setLyricsPattern] = useState<number[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [lastGuessTeamId, setLastGuessTeamId] = useState<string>("");
  const [mapLocked, setMapLocked] = useState(true);
  const [geoCountdown, setGeoCountdown] = useState<number | null>(null);
  const [geoTimerUsed, setGeoTimerUsed] = useState(false);
  const [geoPotential, setGeoPotential] = useState<number>(0);
  const [geoCostApplied, setGeoCostApplied] = useState(false);
  const [jokerRound, setJokerRound] = useState<JokerRound | null>(null);
  const [jokerProgress, setJokerProgress] = useState<JokerProgress | null>(null);
  const [showJokerConfetti, setShowJokerConfetti] = useState(false);
  const [timelineQueue, setTimelineQueue] = useState<Question["timelineEvents"]>([]);
  const [timelinePlacedLeft, setTimelinePlacedLeft] = useState<PlacedTimelineEvent[]>([]);
  const [timelinePlacedRight, setTimelinePlacedRight] = useState<PlacedTimelineEvent[]>([]);
  const [timelineCenterYear, setTimelineCenterYear] = useState<number>(2000);
  const [timelineTeamIndex, setTimelineTeamIndex] = useState(0);
  const [timelineOutcomes, setTimelineOutcomes] = useState<TimelinePlacementOutcome[]>([]);
  const [timelineScoreResults, setTimelineScoreResults] = useState<TimelineScoreResult[]>([]);
  const [timelineNoWinner, setTimelineNoWinner] = useState(false);
  const [timelinePotential, setTimelinePotential] = useState<number>(0);
  const [showFinalLeaderboard, setShowFinalLeaderboard] = useState(false);
  const [finalLeaderboardShown, setFinalLeaderboardShown] = useState(false);
  const [isFinalePreview, setIsFinalePreview] = useState(false);
  const [finaleRevealed, setFinaleRevealed] = useState(false);
  const [finaleDrumrollFinished, setFinaleDrumrollFinished] = useState(false);
  const [mcqEliminated, setMcqEliminated] = useState<number[]>([]);
  const [mcqResolved, setMcqResolved] = useState(false);
  const [mcqResolvedInfo, setMcqResolvedInfo] = useState<{
    teamName: string;
    points: number;
  } | null>(null);
  const prevAnsweringTeamRef = useRef<string | null>(null);
  const [slotFaces, setSlotFaces] = useState<Team[]>([]);
  const [slotSpinning, setSlotSpinning] = useState(false);
  const slotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slotTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [slotCollapsed, setSlotCollapsed] = useState(false);
  const slotSpinStopRef = useRef<(() => void) | null>(null);
  const gameModalRef = useRef<HTMLDivElement | null>(null);
  const questionTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("previewFinale") !== "1") return;
    setIsFinalePreview(true);
    setShowFinalLeaderboard(true);
  }, []);

  useEffect(() => {
    setTeams((prev) => {
      if (prev.length === 0) return buildDefaultTeams(settings.themeId);
      let changed = false;
      const reconciled = prev.map((team) => {
        const next = reconcileTeamTheme(team, settings.themeId);
        if (next !== team) changed = true;
        return next;
      });
      return changed ? reconciled : prev;
    });
  }, [setTeams, setQuestions, settings.themeId]);

  const { turnState, setOrder, advanceBoard, advanceLyrics, setTurnState } = useTurnState();
  const turnOrder = turnState.order;
  const boardTurnIndex = turnState.boardIndex;
  const lyricsTurnIndex = turnState.lyricsIndex;
  const scoresHidden = turnState.scoresHidden === true;
  const hiddenScoreTeams = useMemo(() => {
    const byId = new Map(teams.map((team) => [team.id, team]));
    const ordered = (turnState.hiddenScoreOrder ?? [])
      .map((id) => byId.get(id))
      .filter((team): team is Team => Boolean(team));
    const included = new Set(ordered.map((team) => team.id));
    return [...ordered, ...teams.filter((team) => !included.has(team.id))];
  }, [teams, turnState.hiddenScoreOrder]);
  const revealedCategories = useMemo(
    () => new Set(turnState.revealedCategories ?? []),
    [turnState.revealedCategories],
  );
  const activeQuestionSpent = activeQuestion
    ? Boolean(questions.find((question) => question.id === activeQuestion.id)?.answered)
    : false;
  const activeCategoryConcealed = Boolean(
    activeQuestion &&
    settings.hideCategoryHeadersAtStart !== false &&
    !revealedCategories.has(activeQuestion.category),
  );

  const visibleQuestions = useMemo(
    () => getVisibleBoardQuestions(questions, settings.boardRevealRules),
    [questions, settings.boardRevealRules],
  );
  const categories = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    visibleQuestions.forEach((q) => {
      if (!seen.has(q.category)) {
        seen.add(q.category);
        ordered.push(q.category);
      }
    });
    return ordered;
  }, [visibleQuestions]);

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => b.score - a.score),
    [teams],
  );
  const boardComplete = useMemo(
    () => {
      const playable = visibleQuestions.filter(isQuestionReady);
      return playable.length > 0 && playable.every((question) => question.answered);
    },
    [visibleQuestions],
  );
  const playableQuestionCount = useMemo(
    () => visibleQuestions.filter(isQuestionReady).length,
    [visibleQuestions],
  );
  const answeredQuestionCount = useMemo(
    () => visibleQuestions.filter((question) => isQuestionReady(question) && question.answered).length,
    [visibleQuestions],
  );
  const remainingQuestionCount = Math.max(0, playableQuestionCount - answeredQuestionCount);
  const activeHostMessage = useMemo(() => {
    const dismissed = new Set(turnState.dismissedHostMessageIds ?? []);
    return (settings.hostMessages ?? [])
      .map((message, index) => ({ message, index }))
      .filter(({ message }) =>
        message.text.trim()
        && message.afterQuestionCount > 0
        && message.afterQuestionCount <= answeredQuestionCount
        && !dismissed.has(message.id),
      )
      .sort((left, right) =>
        left.message.afterQuestionCount - right.message.afterQuestionCount
        || left.index - right.index,
      )[0]?.message ?? null;
  }, [answeredQuestionCount, settings.hostMessages, turnState.dismissedHostMessageIds]);
  const activeHostMessageResolution = activeHostMessage
    ? turnState.resolvedHostMessages?.[activeHostMessage.id]
    : undefined;
  useEffect(() => {
    if (!activeHostMessage || activeHostMessageResolution) return;
    const resolution = resolveHostMessageTemplate(activeHostMessage.text, teams);
    setTurnState((previous) => {
      if (previous.resolvedHostMessages?.[activeHostMessage.id]) return previous;
      return {
        ...previous,
        resolvedHostMessages: {
          ...(previous.resolvedHostMessages ?? {}),
          [activeHostMessage.id]: resolution,
        },
      };
    });
  }, [activeHostMessage, activeHostMessageResolution, setTurnState, teams]);
  const boardProgressPercent = playableQuestionCount > 0
    ? (answeredQuestionCount / playableQuestionCount) * 100
    : 0;
  const finaleMusicStartSeconds = settings.finaleMusicStartSeconds
    ?? DEFAULT_SETTINGS.finaleMusicStartSeconds;
  const finaleMusicEndSeconds = settings.finaleMusicEndSeconds
    ?? (finaleMusicStartSeconds + (
      settings.finaleMusicDurationSeconds
      ?? (DEFAULT_SETTINGS.finaleMusicEndSeconds - DEFAULT_SETTINGS.finaleMusicStartSeconds)
    ));
  const finaleSoundtrack = useFinaleSoundtrack({
    enabled: settings.finaleMusicEnabled ?? DEFAULT_SETTINGS.finaleMusicEnabled,
    url: settings.finaleMusicUrl ?? DEFAULT_SETTINGS.finaleMusicUrl,
    startSeconds: finaleMusicStartSeconds,
    endSeconds: finaleMusicEndSeconds,
    volume: settings.finaleMusicVolume ?? DEFAULT_SETTINGS.finaleMusicVolume,
    prepare: (playableQuestionCount > 0 && remainingQuestionCount <= 1) || showFinalLeaderboard,
  });
  const finaleSoundtrackReady = !finaleSoundtrack.configured
    || ["ready", "blocked", "ended", "error"].includes(finaleSoundtrack.status);

  useEffect(() => {
    if (!showFinalLeaderboard || finaleRevealed || !finaleDrumrollFinished || !finaleSoundtrackReady) return;
    stopFinaleDrumroll();
    if (finaleSoundtrack.status !== "error") finaleSoundtrack.requestPlay();
    setFinaleRevealed(true);
  }, [
    finaleDrumrollFinished,
    finaleRevealed,
    finaleSoundtrack,
    finaleSoundtrackReady,
    showFinalLeaderboard,
    stopFinaleDrumroll,
  ]);
  const activeTurnOrder = useMemo(
    () => turnOrder.filter((id) => teams.some((t) => t.id === id)),
    [turnOrder, teams],
  );

  const orderTeamsById = useCallback(
    (ids: string[]) =>
      ids
        .map((id) => teams.find((t) => t.id === id))
        .filter((t): t is Team => Boolean(t)),
    [teams],
  );

  const rotateTeams = useCallback(
    (list: Team[], startIndex: number) => {
      if (!list.length) return list;
      const idx = ((startIndex % list.length) + list.length) % list.length;
      return [...list.slice(idx), ...list.slice(0, idx)];
    },
    [],
  );

  const boardTurnOrderTeams = useMemo(
    () => rotateTeams(orderTeamsById(activeTurnOrder), boardTurnIndex),
    [activeTurnOrder, boardTurnIndex, orderTeamsById, rotateTeams],
  );
  const turnOrderRosterChanged =
    turnOrder.length > 0 && teams.some((team) => !activeTurnOrder.includes(team.id));

  useEffect(() => {
    if (!turnOrder.length) return;
    const teamIds = new Set(teams.map((team) => team.id));
    const filteredOrder = turnOrder.filter((id) => teamIds.has(id));
    if (filteredOrder.length === turnOrder.length) return;

    setTurnState((previous) => ({
      ...previous,
      order: filteredOrder,
      boardIndex: filteredOrder.length ? previous.boardIndex % filteredOrder.length : 0,
      lyricsIndex: filteredOrder.length ? previous.lyricsIndex % filteredOrder.length : 0,
    }));
  }, [setTurnState, teams, turnOrder]);
  const getBoardTeamId = () =>
    activeTurnOrder.length > 0
      ? activeTurnOrder[boardTurnIndex % activeTurnOrder.length]
      : "";
  const getLyricsTeamId = () =>
    activeTurnOrder.length > 0
      ? activeTurnOrder[lyricsTurnIndex % activeTurnOrder.length]
      : "";

  const displayTeamId =
    activeQuestion?.type === "lyrics" ? getLyricsTeamId() : getBoardTeamId();
  const currentTeam = teams.find((t) => t.id === displayTeamId);
  const answeringTeamId =
    activeQuestion?.type === "lyrics"
      ? getLyricsTeamId()
      : lastGuessTeamId || selectedTeamId || getBoardTeamId();
  const answeringTeam = teams.find((t) => t.id === answeringTeamId);
  const currentTeamColor = currentTeam ? getTeamAccent(currentTeam).base : "#c99c4a";
  const currentTeamEmoji = currentTeam?.badgeEmoji || "⭐️";
  const answeringTeamColor = answeringTeam ? getTeamAccent(answeringTeam).base : "#3e7959";
  const answeringTeamEmoji = answeringTeam?.badgeEmoji || "⭐️";

  const allLyricsRevealed =
    (activeQuestion?.lyricsSegments?.length ?? 0) > 0 &&
    lyricsRevealed.length === (activeQuestion?.lyricsSegments?.length ?? 0) &&
    lyricsRevealed.every(Boolean);

  const isRedLyric = (idx: number) =>
    activeQuestion?.type === "lyrics" && lyricsPattern.includes(idx);

  useEffect(() => {
    if (slotSpinning) return;
    if (!teams.length) {
      setSlotFaces([]);
      setSlotCollapsed(false);
      return;
    }
    const orderedTeams =
      activeTurnOrder.length > 0
        ? rotateTeams(orderTeamsById(activeTurnOrder), boardTurnIndex)
        : [...teams];
    setSlotFaces(orderedTeams);
    setSlotCollapsed(activeTurnOrder.length > 0);
  }, [teams, activeTurnOrder, slotSpinning, orderTeamsById, rotateTeams, boardTurnIndex]);

  useEffect(() => {
    return () => {
      if (slotIntervalRef.current) {
        clearInterval(slotIntervalRef.current);
      }
      if (slotTimeoutRef.current) {
        clearTimeout(slotTimeoutRef.current);
      }
      if (slotSpinStopRef.current) {
        slotSpinStopRef.current();
        slotSpinStopRef.current = null;
      }
    };
  }, []);

  const startTurnOrder = () => {
    if (teams.length === 0 || slotSpinning) return;
    setSlotSpinning(true);
    setSlotCollapsed(false);
    if (slotSpinStopRef.current) {
      slotSpinStopRef.current();
      slotSpinStopRef.current = null;
    }
    slotSpinStopRef.current = startSlotSpinLoop();
    const spinDuration = 1800 + Math.random() * 600;
    const tick = setInterval(() => {
      setSlotFaces((prev) => {
        if (!teams.length) return prev;
        return shuffle([...teams]);
      });
    }, 90);
    slotIntervalRef.current = tick;

    if (slotTimeoutRef.current) {
      clearTimeout(slotTimeoutRef.current);
    }
    slotTimeoutRef.current = setTimeout(() => {
      if (slotIntervalRef.current) {
        clearInterval(slotIntervalRef.current);
        slotIntervalRef.current = null;
      }
      const shuffled = shuffle([...teams].map((t) => t.id));
      setOrder(shuffled);
      setSelectedTeamId("");
      const orderedTeams = orderTeamsById(shuffled);
      setSlotFaces(orderedTeams);
      setSlotSpinning(false);
      setSlotCollapsed(true);
      if (slotSpinStopRef.current) {
        slotSpinStopRef.current();
        slotSpinStopRef.current = null;
      } else {
        stopSlotSpinLoop();
      }
      playSlotResolve();
      slotTimeoutRef.current = null;
    }, spinDuration);
  };

  const requestTurnOrderDraw = () => {
    if (
      activeTurnOrder.length > 0 &&
      answeredQuestionCount > 0 &&
      !window.confirm(
        "Redrawing replaces the current team order and makes the first newly drawn team current. Scores and played questions are unchanged.",
      )
    ) {
      return;
    }
    startTurnOrder();
  };

  const resetTimelineState = () => {
    setTimelineQueue([]);
    setTimelinePlacedLeft([]);
    setTimelinePlacedRight([]);
    setTimelineCenterYear(2000);
    setTimelineTeamIndex(0);
    setTimelineOutcomes([]);
    setTimelineScoreResults([]);
    setTimelineNoWinner(false);
    setTimelinePotential(0);
  };

  const getActiveTimelineTeamId = () => {
    const orderList =
      turnOrder.length > 0 ? activeTurnOrder : teams.map((t) => t.id);
    if (!orderList.length) return "";
    return orderList[timelineTeamIndex % orderList.length];
  };

  const advanceTimelineTeam = () => {
    const orderList =
      turnOrder.length > 0 ? activeTurnOrder : teams.map((t) => t.id);
    if (!orderList.length) return;
    setTimelineTeamIndex((idx) => (idx + 1) % orderList.length);
  };

  const openQuestion = (question: Question) => {
    questionTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setJokerRound(null);
    setJokerProgress(null);
    resetTimelineState();
    setMcqEliminated([]);
    setMcqResolved(false);
    setMcqResolvedInfo(null);
    let normalized = question;
    if (question.type === "lyrics") {
      const pattern = generateRedPattern(question.lyricsSegments?.length ?? 0);
      normalized = { ...question, lyricsRedPattern: pattern };
      setLyricsPattern(pattern);
      setTurnState((prev) => ({ ...prev, lyricsIndex: prev.boardIndex }));
    }
    if (question.type === "geoguesser") {
      const duration = question.geoTimerSeconds ?? 10;
      normalized = { ...question, geoTimerSeconds: duration };
      setGeoPotential(question.points ?? 0);
      setGeoCostApplied(false);
    }
    if (question.type === "joker") {
      const count = Math.max(3, Math.min(9, question.jokerCount ?? 5));
      const minVal = Number.isFinite(question.jokerMin) ? Number(question.jokerMin) : 1;
      let maxVal = Number.isFinite(question.jokerMax) ? Number(question.jokerMax) : 9;
      if (minVal >= maxVal) {
        maxVal = minVal + 1;
      }
      playJokerSparkle();
      const basePoints = question.points ?? 0;
      const maxScore = basePoints * 2;
      const computedIncrement =
        count > 0 ? Math.max(0, Math.round((maxScore - basePoints) / count)) : 0;
      const increment = computedIncrement;
      const rand = (min: number, max: number) =>
        Math.floor(Math.random() * (max - min + 1)) + min;
      const numbers = Array.from({ length: count }, () => rand(minVal, maxVal));
      const targets = numbers.map((num) => {
        let target = rand(minVal, maxVal);
        let attempts = 0;
        while (target === num && attempts < 10) {
          target = rand(minVal, maxVal);
          attempts += 1;
        }
        if (target === num) {
          target = num === maxVal ? num - 1 : num + 1;
        }
        return target;
      });
      const correctDirs = targets.map((target, idx) =>
        target > numbers[idx] ? "above" : "below",
      );
      const jokerIndex = Math.floor(Math.random() * numbers.length);
      const jokerPosition = Math.random() < 0.5 ? "above" : "below";
      setJokerRound({
        numbers,
        targets,
        correctDirs,
        jokerIndex,
        jokerPosition,
        increment,
      });
      setJokerProgress({
        currentIndex: 0,
        results: new Array(numbers.length).fill("pending"),
        score: basePoints,
        finished: false,
        chosenPositions: new Array(numbers.length).fill(null),
      });
    }
    if (question.type === "timeline") {
      const events = shuffle([...(question.timelineEvents ?? [])]);
      setTimelineQueue(events);
      setTimelinePlacedLeft([]);
      setTimelinePlacedRight([]);
      setTimelineCenterYear(question.timelineCenterYear ?? 2000);
      setTimelineTeamIndex(0);
      setTimelineOutcomes([]);
      const timelineTeamOrder = activeTurnOrder.length > 0
        ? activeTurnOrder
        : teams.map((team) => team.id);
      setTimelineScoreResults(timelineTeamOrder.flatMap((teamId) => {
        const team = teams.find((candidate) => candidate.id === teamId);
        if (!team) return [];
        return [{
          teamId: team.id,
          teamName: team.name,
          teamColor: getTeamAccent(team).base,
          teamEmoji: team.badgeEmoji,
          correctCount: 0,
          sharedMissCount: 0,
          points: 0,
        }];
      }));
      setTimelineNoWinner(false);
      setTimelinePotential(question.points ?? 0);
      const boardId =
        activeTurnOrder.length > 0
          ? activeTurnOrder[boardTurnIndex % activeTurnOrder.length]
          : teams[0]?.id ?? "";
      setSelectedTeamId(boardId);
    }
    if (question.type === "audio") {
      const duration = Math.max(1, question.audioStopSeconds ?? 10);
      normalized = { ...question, audioStopSeconds: duration };
    }
    setActiveQuestion(normalized);
    setShowAnswer(false);
    setGeoTimerUsed(false);
    setGeoCountdown(null);
    setMapLocked(true);
    setMcqEliminated([]);
    if (normalized.type === "lyrics") {
      const len = normalized.lyricsSegments?.length ?? 0;
      setLyricsRevealed(new Array(len).fill(false));
      const boardId =
        activeTurnOrder.length > 0
          ? activeTurnOrder[boardTurnIndex % activeTurnOrder.length]
          : "";
      setSelectedTeamId(boardId);
    } else {
      setLyricsRevealed([]);
      const boardId =
        activeTurnOrder.length > 0
          ? activeTurnOrder[boardTurnIndex % activeTurnOrder.length]
          : "";
      setSelectedTeamId(boardId);
    }
  };

  const closeModal = () => {
    setActiveQuestion(null);
    setShowAnswer(false);
    setSelectedTeamId("");
    setLyricsRevealed([]);
    setLastGuessTeamId("");
    setMapLocked(true);
    setLyricsPattern([]);
    setGeoCountdown(null);
    setGeoTimerUsed(false);
    setGeoPotential(0);
    setGeoCostApplied(false);
    setJokerRound(null);
    setJokerProgress(null);
    setShowJokerConfetti(false);
    resetTimelineState();
    setMcqEliminated([]);
    setMcqResolved(false);
    setMcqResolvedInfo(null);
  };

  useEffect(() => {
    if (!activeQuestion || !gameModalRef.current) return;
    const dialog = gameModalRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => dialog.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.querySelector<HTMLButtonElement>(".game-modal-close")?.click();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      requestAnimationFrame(() => questionTriggerRef.current?.focus());
    };
  }, [activeQuestion]);

  const handleRevealLine = (idx: number) => {
    setLyricsRevealed((prev) => {
      if (prev[idx]) return prev;
      const next = [...prev];
      next[idx] = true;
      return next;
    });
    const guessTeamId =
      activeTurnOrder.length > 0
        ? activeTurnOrder[lyricsTurnIndex % activeTurnOrder.length]
        : selectedTeamId;
    if (guessTeamId) {
      setLastGuessTeamId(guessTeamId);
      setSelectedTeamId(guessTeamId);
    }
    if (isRedLyric(idx)) {
      playSadBlip();
      advanceLyrics();
    }
  };

  const handleLyricsNextTeam = () => {
    if (!activeQuestion || activeQuestion.type !== "lyrics") return;
    playSadBlip();
    advanceLyrics();
  };

  useEffect(() => {
    if (!activeQuestion || activeQuestion.type !== "geoguesser") return;
    if (showAnswer) return;
    if (mapLocked || geoCountdown === null) return;
    if (geoCountdown <= 3 && geoCountdown > 0) {
      playCountdownBeep(780 + geoCountdown * 80);
    }
    if (geoCountdown <= 0) return;
    const id = setTimeout(() => {
      setGeoCountdown((prev) => (prev !== null ? prev - 1 : prev));
    }, 1000);
    return () => clearTimeout(id);
  }, [geoCountdown, mapLocked, activeQuestion]);

  useEffect(() => {
    if (!activeQuestion || activeQuestion.type !== "geoguesser") return;
    if (mapLocked || showAnswer) return;
    if (geoCountdown === 0) {
      playFinalAlarm();
    }
    if (geoCountdown === 0) {
      setMapLocked(true);
      setGeoCountdown(null);
    }
  }, [geoCountdown, mapLocked, activeQuestion, activeTurnOrder, boardTurnIndex, advanceBoard]);

  useEffect(() => {
    // reset tracking when question changes
    prevAnsweringTeamRef.current = answeringTeamId ?? null;
    setGeoTimerUsed(false);
    setGeoCountdown(null);
    setMapLocked(true);
  }, [activeQuestion?.id]);

  useEffect(() => {
    if (!activeQuestion) return;
    if (activeQuestion.type === "geoguesser" && showAnswer) {
      setGeoCountdown(null);
      setMapLocked(true);
    }
    prevAnsweringTeamRef.current = answeringTeamId ?? null;
  }, [answeringTeamId, activeQuestion?.id, activeQuestion?.type, showAnswer]);

  useEffect(() => {
    if (activeQuestion) return;
    if (activeHostMessage) return;
    if (showFinalLeaderboard) return;
    if (finalLeaderboardShown) return;
    if (questions.length === 0) return;
    const playable = questions.filter(isQuestionReady);
    const allAnswered = playable.length > 0 && playable.every((q) => q.answered);
    if (allAnswered) {
      setFinaleRevealed(false);
      setShowFinalLeaderboard(true);
      setFinalLeaderboardShown(true);
    }
  }, [questions, activeQuestion, activeHostMessage, showFinalLeaderboard, finalLeaderboardShown]);

  const toggleGeoLock = () => {
    if (!activeQuestion || activeQuestion.type !== "geoguesser") return;
    if (geoTimerUsed && mapLocked) return;
    if (mapLocked) {
      if (!geoCostApplied) {
        const levels = activeQuestion.geoUnlockLevels === 2 ? 2 : 1;
        setGeoPotential(getGeoExploreValue(
          activeQuestion.points,
          levels,
          questions.map((question) => question.points),
        ));
        setGeoCostApplied(true);
      }
      const duration = Math.max(3, Math.min(90, activeQuestion.geoTimerSeconds ?? 10));
      setGeoTimerUsed(true);
      setGeoCountdown(duration);
      setMapLocked(false);
    } else {
      setMapLocked(true);
      setGeoCountdown(null);
    }
  };

  const applyScoreChange = (
    teamId: string,
    delta: number,
    reason: string,
    questionId?: string,
  ) => {
    if (!teamId || !Number.isFinite(delta) || delta === 0) return;
    const team = teams.find((candidate) => candidate.id === teamId);
    if (!team) return;
    setTeams((previous) =>
      previous.map((candidate) =>
        candidate.id === teamId
          ? { ...candidate, score: candidate.score + delta }
          : candidate,
      ),
    );
    setScoreHistory((previous) => [
      {
        id: makeId("score"),
        teamId,
        teamName: team.name,
        delta,
        reason,
        createdAt: new Date().toISOString(),
        questionId,
      },
      ...previous,
    ].slice(0, 100));
  };

  const undoScoreChange = (transactionId: string) => {
    const transaction = scoreHistory.find((entry) => entry.id === transactionId);
    if (!transaction) return;
    setTeams((previous) =>
      previous.map((team) =>
        team.id === transaction.teamId
          ? { ...team, score: team.score - transaction.delta }
          : team,
      ),
    );
    setScoreHistory((previous) =>
      previous.filter((entry) => entry.id !== transactionId),
    );
  };

  const markAnswered = (correct: boolean, stageResult?: { points: number; distanceKm: number | null }) => {
    if (!activeQuestion) return;
    if (remainingQuestionCount === 1 && isQuestionReady(activeQuestion) && !activeQuestion.answered) {
      setFinaleRevealed(false);
      setFinaleDrumrollFinished(false);
      const dismissed = new Set(turnState.dismissedHostMessageIds ?? []);
      const messageComesFirst = (settings.hostMessages ?? []).some((message) =>
        message.text.trim()
        && message.afterQuestionCount <= answeredQuestionCount + 1
        && !dismissed.has(message.id),
      );
      if (!messageComesFirst) {
        startFinaleDrumroll(() => setFinaleDrumrollFinished(true));
      }
    }
    const basePoints = activeQuestion.points ?? 0;
    const teamIdToScore =
      activeQuestion.type === "lyrics"
        ? getLyricsTeamId()
        : lastGuessTeamId || selectedTeamId || getBoardTeamId();

    if (activeQuestion.type === "booby" && !correct && teamIdToScore) {
      const team = teams.find((candidate) => candidate.id === teamIdToScore);
      if (team) {
        setScoreHistory((previous) => previous.some((entry) => entry.questionId === activeQuestion.id)
          ? previous
          : [{
              id: makeId("score"),
              teamId: team.id,
              teamName: team.name,
              delta: 0,
              reason: `${activeQuestion.category} · ${activeQuestion.points} · Challenge not completed · 0 pts`,
              createdAt: new Date().toISOString(),
              questionId: activeQuestion.id,
            }, ...previous].slice(0, 100));
      }
    }

    const rewardPoints = activeQuestion.type === "geoguesser"
      ? stageResult ? Math.max(0, stageResult.points) : Math.max(0, geoPotential)
      : activeQuestion.type === "audio"
        ? getAudioAvailablePoints(
            basePoints,
            turnState.audioPlaybackCounts?.[activeQuestion.id] ?? 0,
            questions.map((question) => question.points),
            turnState.audioReplayValues?.[activeQuestion.id],
          )
        : basePoints;

    if (teamIdToScore && correct && rewardPoints > 0) {
      applyScoreChange(
        teamIdToScore,
        rewardPoints,
        `${activeQuestion.category} · ${activeQuestion.points} · ${stageResult ? `Pin the Globe · ${stageResult.distanceKm === null ? "No pin" : `${stageResult.distanceKm.toFixed(1)} km away`}` : activeQuestion.type === "booby" ? "Challenge completed" : "Correct"}${activeQuestion.type === "audio" && rewardPoints < basePoints ? ` after replay (${rewardPoints} awarded)` : ""}`,
        activeQuestion.id,
      );
    }
    if (stageResult && teamIdToScore && rewardPoints === 0) {
      const team = teams.find((candidate) => candidate.id === teamIdToScore);
      if (team) setScoreHistory((previous) => [{
        id: makeId("score"), teamId: team.id, teamName: team.name, delta: 0,
        reason: `${activeQuestion.category} · ${activeQuestion.points} · Pin the Globe · ${stageResult.distanceKm === null ? "No pin" : `${stageResult.distanceKm.toFixed(1)} km away`} · 0 pts`,
        createdAt: new Date().toISOString(), questionId: activeQuestion.id,
      }, ...previous].slice(0, 100));
    }
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === activeQuestion.id ? { ...q, answered: true } : q,
      ),
    );
    if (activeTurnOrder.length > 0) {
      advanceBoard();
    }
    setLastGuessTeamId("");
    closeModal();
  };

  const getMaxJokerScore = () => {
    const base = activeQuestion?.points ?? 0;
    return base * 2;
  };

  const handleJokerGuess = (position: "above" | "below") => {
    if (!activeQuestion || activeQuestion.type !== "joker") return;
    if (!jokerRound || !jokerProgress || jokerProgress.finished) return;
    const step = jokerProgress.currentIndex;
    const total = jokerRound.numbers.length;
    const idx = total - 1 - step; // start from rightmost, move left
    if (idx < 0 || idx >= total) return;

    const nextResults = [...jokerProgress.results];
    const nextChosen = [...jokerProgress.chosenPositions];
    nextChosen[idx] = position;

    const rotate = activeQuestion.jokerRotateOnMiss ?? true;

    if (
      jokerRound.jokerIndex === idx &&
      jokerRound.jokerPosition === position
    ) {
      nextResults[idx] = "joker";
      playBigWin();
      setShowJokerConfetti(true);
      setJokerProgress({
        currentIndex: step + 1,
        results: nextResults,
        score: getMaxJokerScore(),
        finished: true,
        chosenPositions: nextChosen,
      });
      return;
    }

    const correct = jokerRound.correctDirs[idx] === position;
    nextResults[idx] = correct ? "correct" : "wrong";
    if (correct) {
      playSuccessChime();
    } else {
      playDownbeat();
    }
    const incrementVal = jokerRound.increment ?? 0;
    const delta = correct ? incrementVal : 0;
    const basePoints = activeQuestion.points ?? 0;
    const updatedScore = Math.max(
      basePoints,
      Math.min(getMaxJokerScore(), (jokerProgress.score ?? 0) + delta),
    );
    const nextIndex = step + 1;
    setJokerProgress({
      currentIndex: nextIndex,
      results: nextResults,
      score: updatedScore,
      finished: nextIndex >= total,
      chosenPositions: nextChosen,
    });

    if (!correct) {
      if (rotate) {
        advanceBoard();
        const nextTeamId =
          activeTurnOrder.length > 0
            ? activeTurnOrder[(boardTurnIndex + 1) % activeTurnOrder.length]
            : "";
        setSelectedTeamId(nextTeamId);
      }
    }
  };

  const finishJokerQuestion = () => {
    if (!activeQuestion || activeQuestion.type !== "joker") return;
    if (!jokerProgress) return;
    const teamId = answeringTeamId;
    if (teamId) {
      applyScoreChange(
        teamId,
        Math.max(0, jokerProgress.score),
        `${activeQuestion.category} · Joker result`,
        activeQuestion.id,
      );
    }
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === activeQuestion.id ? { ...q, answered: true } : q,
      ),
    );
    if (activeTurnOrder.length > 0) {
      advanceBoard();
    }
    setLastGuessTeamId("");
    closeModal();
  };

  const handleMcqSelect = (idx: number) => {
    if (!activeQuestion || activeQuestion.type !== "mcq") return;
    const opts = activeQuestion.mcqOptions ?? [];
    if (!opts.length) return;
    if (mcqResolved) return;
    const currentTeamId = lastGuessTeamId || selectedTeamId || getBoardTeamId();
    if (currentTeamId) {
      setLastGuessTeamId(currentTeamId);
    }
    const correctIdx = activeQuestion.mcqCorrectIndex ?? 0;
    const isCorrect = idx === correctIdx;
    if (isCorrect) {
      playSuccessChime();
      if (currentTeamId) {
        const awarded = activeQuestion.points ?? 0;
        applyScoreChange(
          currentTeamId,
          awarded,
          `${activeQuestion.category} · ${activeQuestion.points} · Multiple choice correct`,
          activeQuestion.id,
        );
        const winnerTeam = teams.find((t) => t.id === currentTeamId);
        setMcqResolvedInfo({
          teamName: winnerTeam?.name ?? "Team",
          points: awarded,
        });
      }
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === activeQuestion.id ? { ...q, answered: true } : q,
        ),
      );
      if (activeTurnOrder.length > 0) {
        advanceBoard();
      }
      setMcqResolved(true);
    } else {
      playDownbeat();
      setMcqEliminated((previous) => previous.includes(idx) ? previous : [...previous, idx]);
      if (activeTurnOrder.length > 0) {
        const nextTeamId = activeTurnOrder[(boardTurnIndex + 1) % activeTurnOrder.length];
        advanceBoard();
        setSelectedTeamId(nextTeamId);
        setLastGuessTeamId("");
      }
    }
  };

  const handleTimelinePlace = (slot: { index: number; onYear?: number | null }) => {
    if (!activeQuestion || activeQuestion.type !== "timeline") return;
    const currentTeamId = getActiveTimelineTeamId();
    const current = timelineQueue?.[0];
    if (!current || current.year === null || current.year === undefined) {
      return;
    }
    const rotateOnMiss = activeQuestion.timelineRotateOnMiss ?? true;

    const remaining = (timelineQueue ?? []).slice(1);

    // Build combined sorted timeline including center pivot
    const combined = [
      ...(timelinePlacedLeft ?? []),
      {
        id: "__center",
        year: timelineCenterYear,
        text: "Center",
        timelineText: activeQuestion.timelineCenterLabel ?? "Center year",
      },
      ...(timelinePlacedRight ?? []),
    ].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

    // Calculate actual insertion index for the current event (first >=)
    const candidateYear = current.year ?? 0;
    let actualIndex = combined.findIndex((ev) => (ev.year ?? 0) >= candidateYear);
    if (actualIndex === -1) actualIndex = combined.length;

    const targetOnYear = slot.onYear ?? null;
    const actualYearAtIndex = combined[actualIndex]?.year ?? null;

    const correct =
      targetOnYear !== null && targetOnYear !== undefined
        ? candidateYear === targetOnYear
        : slot.index === actualIndex && candidateYear !== actualYearAtIndex;

    const placedEvent: PlacedTimelineEvent = {
      ...current,
      status: correct ? "correct" : "wrong",
    };

    if (candidateYear < (timelineCenterYear ?? 0)) {
      setTimelinePlacedLeft((prev) =>
        [...(prev ?? []), placedEvent].sort((a, b) => (a.year ?? 0) - (b.year ?? 0)),
      );
    } else {
      setTimelinePlacedRight((prev) =>
        [...(prev ?? []), placedEvent].sort((a, b) => (a.year ?? 0) - (b.year ?? 0)),
      );
    }

    const outcomesForSettlement = currentTeamId
      ? [...timelineOutcomes, { teamId: currentTeamId, correct }]
      : timelineOutcomes;
    const teamOrderForSettlement =
      activeTurnOrder.length > 0 ? activeTurnOrder : teams.map((team) => team.id);
    const allocations = allocateTimelinePoints(
      timelinePotential,
      activeQuestion.timelineEvents?.length ?? 0,
      outcomesForSettlement,
      teamOrderForSettlement,
    );
    const results = allocations.flatMap((allocation) => {
      const team = teams.find((candidate) => candidate.id === allocation.teamId);
      if (!team) return [];
      return [{
        teamId: team.id,
        teamName: team.name,
        teamColor: getTeamAccent(team).base,
        teamEmoji: team.badgeEmoji,
        correctCount: allocation.correctCount,
        sharedMissCount: allocation.sharedMissCount,
        points: allocation.points,
      }];
    });
    setTimelineOutcomes(outcomesForSettlement);
    setTimelineScoreResults(results);

    if (correct) {
      playSuccessChime();
    } else {
      playDownbeat();
    }

    setTimelineQueue(remaining);
    if (!correct && remaining.length > 0 && rotateOnMiss) {
      advanceTimelineTeam();
    }

    if (remaining.length === 0) {
      setTimelineNoWinner(results.length === 0);
      results.forEach((result) => {
        applyScoreChange(
          result.teamId,
          result.points,
          `${activeQuestion.category} · Timeline · ${result.correctCount} correct · ${result.sharedMissCount} shared misses`,
          activeQuestion.id,
        );
      });
      setQuestions((qs) =>
        qs.map((q) => (q.id === activeQuestion.id ? { ...q, answered: true } : q)),
      );
      if (activeTurnOrder.length > 0) {
        advanceBoard();
      }
      // keep modal open so hosts can review the timeline; allow manual close
    }
  };

  const adjustScore = (teamId: string, delta: number, reason = "Host adjustment") => {
    applyScoreChange(teamId, delta, reason);
  };

  const setScore = (teamId: string, value: number) => {
    const team = teams.find((candidate) => candidate.id === teamId);
    if (!team || !Number.isFinite(value)) return;
    applyScoreChange(teamId, value - team.score, "Host set score directly");
  };

  const renderModal = () => {
    if (!activeQuestion) return null;
    const modalQuestion = activeCategoryConcealed
      ? { ...activeQuestion, category: "" }
      : activeQuestion;
    if (activeQuestion.type === "lyrics") {
      return (
        <LyricsModal
          question={modalQuestion}
          lyricsRevealed={lyricsRevealed}
          isRed={isRedLyric}
          onRevealLine={handleRevealLine}
          onRevealAll={() =>
            setLyricsRevealed(
              new Array(activeQuestion.lyricsSegments?.length ?? 0).fill(true),
            )
          }
          allRevealed={allLyricsRevealed}
          onRevealAnswer={() => setShowAnswer(true)}
          showAnswer={showAnswer}
          currentTeamName={currentTeam?.name}
          currentTeamColor={currentTeamColor}
          currentTeamEmoji={currentTeamEmoji}
          answeringTeamName={answeringTeam?.name}
          answeringTeamColor={answeringTeamColor}
          answeringTeamEmoji={answeringTeamEmoji}
          answerVideoUrl={activeQuestion.answerVideoUrl}
          answerVideoAutoplay={activeQuestion.answerVideoAutoplay ?? true}
          onNextTeam={handleLyricsNextTeam}
          onCorrect={() => markAnswered(true)}
          onWrong={() => markAnswered(false)}
          disableActions={!answeringTeam}
        />
      );
    }
    if (activeQuestion.type === "geoguesser") {
      return (
        <GeoguesserModal
          question={modalQuestion}
          boardValues={questions.map((question) => question.points)}
          currentTeamName={currentTeam?.name}
          currentTeamColor={currentTeamColor}
          currentTeamEmoji={currentTeamEmoji}
          answeringTeamColor={answeringTeamColor}
          answeringTeamName={answeringTeam?.name}
          answeringTeamEmoji={answeringTeamEmoji}
          mapLocked={mapLocked}
          onToggleLock={toggleGeoLock}
          onRevealAnswer={() => setShowAnswer(true)}
          showAnswer={showAnswer}
          onCorrect={() => markAnswered(true)}
          onWrong={() => markAnswered(false)}
          disableActions={!answeringTeam}
          countdownSeconds={geoCountdown}
          timerUsed={geoTimerUsed}
          potentialPoints={geoPotential}
          onStageFinish={(points, distanceKm) => markAnswered(points > 0, { points, distanceKm })}
        />
      );
    }
    if (activeQuestion.type === "mcq") {
      return (
        <McqModal
          question={modalQuestion}
          currentTeamName={currentTeam?.name}
          currentTeamColor={currentTeamColor}
          currentTeamEmoji={currentTeamEmoji}
          answeringTeamName={answeringTeam?.name}
          answeringTeamColor={answeringTeamColor}
          answeringTeamEmoji={answeringTeamEmoji}
          eliminated={mcqEliminated}
          onSelect={handleMcqSelect}
          resolved={mcqResolved}
          correctIndex={activeQuestion.mcqCorrectIndex ?? 0}
          resolvedInfo={mcqResolvedInfo}
          onContinue={closeModal}
        />
      );
    }
    if (activeQuestion.type === "joker" && jokerRound && jokerProgress) {
      return (
        <JokerModal
          question={modalQuestion}
          teams={teams}
          currentTeamName={currentTeam?.name}
          currentTeamColor={currentTeamColor}
          answeringTeamName={answeringTeam?.name}
          answeringTeamEmoji={answeringTeamEmoji}
          round={jokerRound}
          progress={jokerProgress}
          onGuess={handleJokerGuess}
          onFinish={finishJokerQuestion}
          disableActions={!answeringTeam}
          maxScore={getMaxJokerScore()}
          rotateInfo={activeQuestion.jokerRotateOnMiss ?? true}
          incrementInfo={jokerRound.increment}
        />
      );
    }
    if (activeQuestion.type === "timeline") {
      const timelineTeamId = getActiveTimelineTeamId();
      const timelineTeam = teams.find((t) => t.id === timelineTeamId);
      const timelineTeamEmoji = timelineTeam?.badgeEmoji || "⭐️";
      return (
        <TimelineModal
          category={modalQuestion.category}
          centerYear={timelineCenterYear}
          currentTeamName={timelineTeam?.name}
          currentTeamColor={timelineTeam ? getTeamAccent(timelineTeam).base : "#c99c4a"}
          currentTeamEmoji={timelineTeamEmoji}
          queue={timelineQueue ?? []}
          placedLeft={timelinePlacedLeft ?? []}
          placedRight={timelinePlacedRight ?? []}
          onPlace={handleTimelinePlace}
          disableActions={!timelineTeamId}
          scoreResults={timelineScoreResults}
          points={activeQuestion.points}
          rotateInfo={activeQuestion.timelineRotateOnMiss ?? true}
          noWinner={timelineNoWinner}
          title={activeQuestion.timelineTitle}
          centerLabel={activeQuestion.timelineCenterLabel}
          potentialScore={timelinePotential}
          basePoints={activeQuestion.points}
        />
      );
    }
    if (activeQuestion.type === "audio") {
      return (
        <AudioModal
          question={modalQuestion}
          boardValues={questions.map((question) => question.points)}
          playbackCount={turnState.audioPlaybackCounts?.[activeQuestion.id] ?? 0}
          lockedReplayValue={turnState.audioReplayValues?.[activeQuestion.id]}
          onPlaybackStarted={(mode, replayValue) => {
            const questionId = activeQuestion.id;
            const targetCount = mode === "replay" ? 2 : 1;
            setTurnState((previous) => ({
              ...previous,
              audioPlaybackCounts: {
                ...previous.audioPlaybackCounts,
                [questionId]: Math.max(previous.audioPlaybackCounts?.[questionId] ?? 0, targetCount),
              },
              audioReplayValues: replayValue === null
                ? previous.audioReplayValues
                : {
                    ...previous.audioReplayValues,
                    [questionId]: previous.audioReplayValues?.[questionId] ?? replayValue,
                  },
            }));
          }}
          currentTeamName={currentTeam?.name}
          currentTeamColor={currentTeamColor}
          currentTeamEmoji={currentTeamEmoji}
          answeringTeamName={answeringTeam?.name}
          answeringTeamColor={answeringTeamColor}
          answeringTeamEmoji={answeringTeamEmoji}
          onRevealAnswer={() => setShowAnswer(true)}
          showAnswer={showAnswer}
          onCorrect={() => markAnswered(true)}
          onWrong={() => markAnswered(false)}
          disableActions={!answeringTeam}
        />
      );
    }
    if (activeQuestion.type === "booby") {
      return (
        <BoobyModal
          key={activeQuestion.id}
          question={modalQuestion}
          showMessage={showAnswer}
          onReveal={() => setShowAnswer(true)}
          onWon={() => markAnswered(true)}
          onLost={() => markAnswered(false)}
          disableActions={!answeringTeam}
          teamName={answeringTeam?.name ?? currentTeam?.name}
          teamColor={answeringTeam ? answeringTeamColor : currentTeamColor}
          teamEmoji={answeringTeam ? answeringTeamEmoji : currentTeamEmoji}
        />
      );
    }
    return (
      <StandardModal
        question={modalQuestion}
        currentTeamName={currentTeam?.name}
        currentTeamColor={currentTeamColor}
        currentTeamEmoji={currentTeamEmoji}
        answeringTeamName={answeringTeam?.name}
        answeringTeamColor={answeringTeamColor}
        answeringTeamEmoji={answeringTeamEmoji}
        onRevealAnswer={() => setShowAnswer(true)}
        showAnswer={showAnswer}
        onCorrect={() => markAnswered(true)}
        onWrong={() => markAnswered(false)}
        disableActions={!answeringTeam}
      />
    );
  };

  return (
    <main className="game-page" style={{ display: "grid", gap: "14px" }}>
      <div className="game-stage">
      <section
        className="game-board-panel board-viewport-panel"
        id="game-board-stage"
        style={{ padding: "6px" }}
      >
        <div
          className="game-command-bar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "10px",
            flexWrap: "wrap",
          }}
        >
          <div className={`board-progress${boardComplete ? " complete" : ""}`}>
            <div className="board-progress-heading">
              <span>
                {playableQuestionCount === 0
                  ? "Board not ready"
                  : boardComplete
                    ? "Board complete"
                    : "Board progress"}
              </span>
              <span className="board-progress-heading-actions">
                {playableQuestionCount > 0 && boardComplete && <span aria-hidden="true">✓</span>}
                {process.env.NODE_ENV === "development" && (
                  <button
                    className="finale-preview-trigger"
                    type="button"
                    onClick={() => {
                      setIsFinalePreview(true);
                      setFinaleRevealed(false);
                      setFinaleDrumrollFinished(false);
                      setShowFinalLeaderboard(true);
                      startFinaleDrumroll(() => setFinaleDrumrollFinished(true));
                    }}
                  >
                    Preview finale
                  </button>
                )}
              </span>
            </div>
            <div className="board-progress-counts">
              {playableQuestionCount === 0 ? (
                <span className="board-progress-empty">Add questions to begin</span>
              ) : (
                <>
                  <span><strong>{answeredQuestionCount}</strong> played</span>
                  <span aria-hidden="true">·</span>
                  <span><strong>{remainingQuestionCount}</strong> remaining</span>
                </>
              )}
            </div>
            <div
              className="board-progress-track"
              role="progressbar"
              aria-label="Questions played"
              aria-valuemin={0}
              aria-valuemax={playableQuestionCount || 1}
              aria-valuenow={answeredQuestionCount}
              aria-valuetext={
                playableQuestionCount > 0
                  ? `${answeredQuestionCount} of ${playableQuestionCount} questions played`
                  : "No playable questions"
              }
            >
              <span style={{ width: `${boardProgressPercent}%` }} />
            </div>
          </div>
          <div className={`turn-draw${slotSpinning ? " spinning" : ""}${slotCollapsed && !slotSpinning ? " resolved" : ""}`}>
            <div className="turn-draw-copy">
              <span>Turn draw</span>
              <small>{slotSpinning ? "Drawing…" : slotCollapsed ? "On the board" : "Pick the opening team"}</small>
            </div>
            <div className="turn-reel" aria-live="off">
              {teams.length === 0 ? (
                <span className="turn-reel-empty">Add teams</span>
              ) : slotCollapsed && !slotSpinning ? (
                <TurnOrderRail teams={boardTurnOrderTeams} />
              ) : (
                <div className="turn-reel-window" aria-label="Teams in the turn draw">
                  {(slotFaces.length > 0 ? slotFaces : teams).map((team, idx) => {
                    const accent = team ? getTeamAccent(team) : undefined;
                    return (
                      <div
                        className="turn-reel-token team-identity-surface"
                        key={team?.id ?? `slot-${idx}`}
                        data-emoji-surface={accent?.emojiSurface}
                        style={{
                          "--token-base": accent?.base ?? "#c99c4a",
                          "--token-color": accent?.onLight ?? "#76531a",
                          "--token-glow": accent?.glow ?? "#ead08d",
                          "--token-tint": accent?.tint ?? "#f8e9c7",
                          "--reel-delay": `${idx * 45}ms`,
                        } as React.CSSProperties}
                      >
                        <span className="turn-reel-token-emoji team-identity-emoji">
                          <span aria-hidden>{team?.badgeEmoji ?? "❔"}</span>
                        </span>
                        <span className="turn-reel-token-name">{team?.name ?? "Team"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              className="turn-spin-button"
              type="button"
              onClick={requestTurnOrderDraw}
              disabled={slotSpinning || teams.length === 0}
              data-roster-changed={turnOrderRosterChanged || undefined}
              title={turnOrderRosterChanged ? "Team list changed — redraw to include everyone" : undefined}
            >
              <span aria-hidden>{slotSpinning ? "•••" : "✦"}</span>
              {slotSpinning ? "Drawing" : activeTurnOrder.length ? "Redraw" : "Spin"}
            </button>
          </div>
        </div>

        {categories.length === 0 ? (
          <div className="card" style={{ padding: "16px", color: "var(--muted)" }}>
            Add categories and questions first in the config pages.
          </div>
        ) : (
          <>
          <div className="board-viewport-frame">
            <div className="board-viewport-grid" inert={!activeTurnOrder.length ? true : undefined} aria-hidden={!activeTurnOrder.length || undefined}>
              <BoardGrid
                categories={categories}
                questions={visibleQuestions}
                teams={teams}
                scoreHistory={scoreHistory}
                concealCategoryHeaders={settings.hideCategoryHeadersAtStart !== false}
                revealedCategories={revealedCategories}
                onRevealCategory={(category) =>
                  setTurnState((previous) => ({
                    ...previous,
                    revealedCategories: Array.from(new Set([
                      ...(previous.revealedCategories ?? []),
                      category,
                    ])),
                  }))
                }
                onOpen={openQuestion}
                scoresHidden={scoresHidden}
              />
            </div>
            {!activeTurnOrder.length && (
              <div className="board-opening-slate">
                <span className="board-opening-kicker">Tonight&apos;s quiz</span>
                <h2>{settings.quizTitle || DEFAULT_SETTINGS.quizTitle}</h2>
                <p>Draw the opening team to unlock the board.</p>
                <button className="button primary" onClick={startTurnOrder} disabled={slotSpinning || teams.length === 0}>
                  {slotSpinning ? "Drawing the turn…" : "Spin to begin"}
                </button>
              </div>
            )}
          </div>
          </>
        )}
      </section>

      <div className="game-leaderboard-panel" id="game-podium">
        <Leaderboard
          teams={scoresHidden ? hiddenScoreTeams : sortedTeams}
          onAdjust={adjustScore}
          onSet={setScore}
          history={scoreHistory}
          onUndo={undoScoreChange}
          compact
          currentTeamId={currentTeam?.id}
          scoresHidden={scoresHidden}
          onToggleScores={() => setTurnState((previous) => previous.scoresHidden
            ? { ...previous, scoresHidden: false, hiddenScoreOrder: [] }
            : {
                ...previous,
                scoresHidden: true,
                hiddenScoreOrder: (() => {
                  const rankedIds = sortedTeams.map((team) => team.id);
                  const randomized = shuffle(teams.map((team) => team.id));
                  return randomized.length > 1 && randomized.every((id, index) => id === rankedIds[index])
                    ? [...randomized.slice(1), randomized[0]]
                    : randomized;
                })(),
              })}
        />
      </div>
      </div>
      {boardComplete && finalLeaderboardShown && !showFinalLeaderboard && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            className="button primary"
            onClick={() => {
              setFinaleRevealed(true);
              setShowFinalLeaderboard(true);
            }}
            style={{ marginTop: "-6px" }}
          >
            Show podium again
          </button>
        </div>
      )}

      {activeQuestion && (
        <div
          className={`game-modal-overlay${activeQuestionSpent ? " is-dismissible" : ""}`}
          onClick={activeQuestionSpent ? closeModal : undefined}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            zIndex: 20,
            padding: "24px 20px 48px",
            pointerEvents: "auto",
            overflowY: "auto",
          }}
        >
          {showJokerConfetti && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                pointerEvents: "none",
                zIndex: 25,
              }}
              aria-hidden
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.16), transparent 30%), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.2), transparent 30%), radial-gradient(circle at 50% 60%, rgba(255,215,0,0.25), transparent 30%)",
                  animation: "joker-confetti 1.2s ease-out forwards",
                }}
              />
            </div>
          )}
          <div
            className={`game-modal-shell type-${activeQuestion.type ?? "standard"}`}
            ref={gameModalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={activeQuestion.type === "booby" && showAnswer
              ? `${activeCategoryConcealed ? "Hidden category" : activeQuestion.category}, challenge, ${activeQuestion.points} points at stake`
              : `${activeCategoryConcealed ? "Hidden category" : activeQuestion.category}, ${activeQuestion.points} point question`}
            style={{
              position: "relative",
              width: "min(900px, 100%)",
              perspective: "1200px",
              marginTop: "12px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {renderModal()}
            <button
              className="game-modal-close"
              onClick={closeModal}
              style={{
                position: "absolute",
                top: "-10px",
                right: "-10px",
                borderRadius: "50%",
                width: "38px",
                height: "38px",
                border: "1px solid rgba(255,255,255,0.3)",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {showFinalLeaderboard && (
        <FinalCelebration
          teams={sortedTeams}
          preview={isFinalePreview}
          revealed={finaleRevealed}
          onReveal={() => {
            stopFinaleDrumroll();
            setFinaleDrumrollFinished(true);
            if (finaleSoundtrack.status !== "error") finaleSoundtrack.requestPlay();
            setFinaleRevealed(true);
          }}
          music={{
            configured: finaleSoundtrack.configured,
            status: finaleSoundtrack.status,
            remaining: finaleSoundtrack.remaining,
            message: finaleSoundtrack.message,
            onStart: finaleSoundtrack.requestPlay,
          }}
          onClose={closeFinalLeaderboard}
        />
      )}
      {activeHostMessage && activeHostMessageResolution && !activeQuestion && !showFinalLeaderboard && (
        <HostMessageOverlay
          key={activeHostMessage.id}
          message={activeHostMessage}
          resolution={activeHostMessageResolution}
          teams={teams}
          answeredQuestionCount={answeredQuestionCount}
          playableQuestionCount={playableQuestionCount}
          onResolutionChange={(resolution) => {
            setTurnState((previous) => ({
              ...previous,
              resolvedHostMessages: {
                ...(previous.resolvedHostMessages ?? {}),
                [activeHostMessage.id]: resolution,
              },
            }));
          }}
          onDismiss={() => {
            const dismissed = new Set(turnState.dismissedHostMessageIds ?? []);
            dismissed.add(activeHostMessage.id);
            const anotherMessageIsDue = (settings.hostMessages ?? []).some((message) =>
              message.id !== activeHostMessage.id
              && message.text.trim()
              && message.afterQuestionCount <= answeredQuestionCount
              && !dismissed.has(message.id),
            );
            if (boardComplete && !anotherMessageIsDue) {
              setFinaleDrumrollFinished(false);
              startFinaleDrumroll(() => setFinaleDrumrollFinished(true));
            }
            setTurnState((previous) => ({
              ...previous,
              dismissedHostMessageIds: Array.from(new Set([
                ...(previous.dismissedHostMessageIds ?? []),
                activeHostMessage.id,
              ])),
            }));
          }}
        />
      )}
      <div className="finale-soundtrack-player" aria-hidden="true">
        <div ref={finaleSoundtrack.playerHostRef} />
      </div>
      <style jsx global>{`
        .flip-inner.flipped {
          transform: rotateY(180deg);
        }
        @keyframes giggle {
          0% {
            transform: translateY(0) rotate(0deg);
          }
          20% {
            transform: translateY(-2px) rotate(-1deg);
          }
          40% {
            transform: translateY(2px) rotate(1deg);
          }
          60% {
            transform: translateY(-3px) rotate(-1.5deg);
          }
          80% {
            transform: translateY(1px) rotate(1deg);
          }
          100% {
            transform: translateY(0) rotate(0deg);
          }
        }
        .lyrics-tile {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .lyrics-tile.concealed:hover {
          animation: giggle 0.7s ease-in-out infinite;
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.25);
        }
        @keyframes boom {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(255, 255, 255, 0.4);
          }
          30% {
            transform: scale(1.08);
            box-shadow: 0 0 30px rgba(255, 255, 255, 0.4);
          }
          60% {
            transform: scale(0.96);
            box-shadow: 0 0 18px rgba(255, 255, 255, 0.2);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(255, 255, 255, 0);
          }
        }
        @keyframes vizPulse {
          0% { transform: scaleY(1); }
          40% { transform: scaleY(1.6); }
          70% { transform: scaleY(0.7); }
          100% { transform: scaleY(1); }
        }
        @keyframes pulse-ring {
          0% {
            box-shadow: 0 0 0 0 rgba(129, 230, 217, 0.4);
          }
          70% {
            box-shadow: 0 0 0 12px rgba(129, 230, 217, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(129, 230, 217, 0);
          }
        }
        @keyframes joker-confetti {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          70% {
            opacity: 0.8;
            transform: scale(1.08);
          }
          100% {
            opacity: 0;
            transform: scale(1.16);
          }
        }
      `}</style>
    </main>
  );

  function closeFinalLeaderboard() {
    stopFinaleDrumroll();
    finaleSoundtrack.stop();
    setFinaleRevealed(false);
    setFinaleDrumrollFinished(false);
    setShowFinalLeaderboard(false);
    if (isFinalePreview) {
      setIsFinalePreview(false);
      return;
    }
    setFinalLeaderboardShown(true);
  }
}
