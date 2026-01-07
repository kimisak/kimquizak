'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardGrid } from "@/components/game/BoardGrid";
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
import { TeamPill } from "@/components/game/TeamPill";
import { useAudioCue } from "@/hooks/useAudioCue";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useSettings } from "@/hooks/useSettings";
import { useTurnState } from "@/hooks/useTurnState";
import { generateRedPattern, shuffle } from "@/lib/redPattern";
import {
  LEGACY_QUESTION_STORAGE_KEY,
  LEGACY_TEAM_STORAGE_KEY,
  QUESTION_STORAGE_KEY,
  TEAM_STORAGE_KEY,
} from "@/lib/storage";
import { type Question, type Team, type TimelineEvent } from "@/lib/types";
import { buildDefaultTeams } from "@/lib/defaultData";

type ActiveQuestion = Question & { category: string };
type PlacedTimelineEvent = TimelineEvent & {
  status?: "correct" | "wrong";
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
    playBoing,
    startSlotSpinLoop,
    stopSlotSpinLoop,
  } = useAudioCue();
  const [teams, setTeams] = usePersistentState<Team[]>(
    TEAM_STORAGE_KEY,
    [],
    [LEGACY_TEAM_STORAGE_KEY],
  );
  const [questions, setQuestions] = usePersistentState<Question[]>(
    QUESTION_STORAGE_KEY,
    [],
    [LEGACY_QUESTION_STORAGE_KEY],
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
  const [lyricsPotential, setLyricsPotential] = useState<number>(0);
  const [jokerRound, setJokerRound] = useState<JokerRound | null>(null);
  const [jokerProgress, setJokerProgress] = useState<JokerProgress | null>(null);
  const [showJokerConfetti, setShowJokerConfetti] = useState(false);
  const [timelineQueue, setTimelineQueue] = useState<Question["timelineEvents"]>([]);
  const [timelinePlacedLeft, setTimelinePlacedLeft] = useState<PlacedTimelineEvent[]>([]);
  const [timelinePlacedRight, setTimelinePlacedRight] = useState<PlacedTimelineEvent[]>([]);
  const [timelineCenterYear, setTimelineCenterYear] = useState<number>(2000);
  const [timelineTeamIndex, setTimelineTeamIndex] = useState(0);
  const [timelineLastCorrectTeamId, setTimelineLastCorrectTeamId] = useState<string | null>(null);
  const [timelineWinnerName, setTimelineWinnerName] = useState<string | null>(null);
  const [timelineWinnerId, setTimelineWinnerId] = useState<string | null>(null);
  const [timelineNoWinner, setTimelineNoWinner] = useState(false);
  const [timelinePotential, setTimelinePotential] = useState<number>(0);
  const [showFinalLeaderboard, setShowFinalLeaderboard] = useState(false);
  const [finalLeaderboardShown, setFinalLeaderboardShown] = useState(false);
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
  const [slotJumpId, setSlotJumpId] = useState<string | null>(null);
  const [slotJumpKey, setSlotJumpKey] = useState<number>(0);
  const slotSpinStopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setTeams((prev) =>
      prev.length === 0 ? buildDefaultTeams(settings.themeId) : prev,
    );
  }, [setTeams, setQuestions, settings.themeId]);

  const { turnState, setOrder, advanceBoard, advanceLyrics, setTurnState } = useTurnState();
  const turnOrder = turnState.order;
  const boardTurnIndex = turnState.boardIndex;
  const lyricsTurnIndex = turnState.lyricsIndex;

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    questions.forEach((q) => {
      if (!seen.has(q.category)) {
        seen.add(q.category);
        ordered.push(q.category);
      }
    });
    return ordered;
  }, [questions]);

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => b.score - a.score),
    [teams],
  );
  const boardComplete = useMemo(
    () => questions.length > 0 && questions.every((q) => q.answered),
    [questions],
  );
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
  const currentTeamColor = currentTeam?.accentBase || "#f2c14f";
  const currentTeamEmoji = currentTeam?.badgeEmoji || "⭐️";
  const answeringTeamColor = answeringTeam?.accentBase || "#81e6d9";
  const answeringTeamEmoji = answeringTeam?.badgeEmoji || "⭐️";

  const allLyricsRevealed =
    (activeQuestion?.lyricsSegments?.length ?? 0) > 0 &&
    lyricsRevealed.length === (activeQuestion?.lyricsSegments?.length ?? 0) &&
    lyricsRevealed.every(Boolean);

  const buildVideoSrc = (url: string | null, shouldAutoplay: boolean) => {
    if (!url) return "";
    const joiner = url.includes("?") ? "&" : "?";
    if (showAnswer && shouldAutoplay) {
      return `${url}${joiner}autoplay=1&playsinline=1`;
    }
    return url;
  };

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
    setSlotFaces(orderedTeams.slice(0, Math.min(3, orderedTeams.length)));
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
        return shuffle([...teams]).slice(0, Math.min(3, teams.length));
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
      setSlotFaces(orderedTeams.slice(0, Math.min(3, orderedTeams.length)));
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

  const resetTimelineState = () => {
    setTimelineQueue([]);
    setTimelinePlacedLeft([]);
    setTimelinePlacedRight([]);
    setTimelineCenterYear(2000);
    setTimelineTeamIndex(0);
    setTimelineLastCorrectTeamId(null);
    setTimelineWinnerName(null);
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
      setTimelineLastCorrectTeamId(null);
      setTimelineWinnerName(null);
      setTimelineWinnerId(null);
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
      setLyricsPotential(normalized.points ?? 0);
      const boardId =
        activeTurnOrder.length > 0
          ? activeTurnOrder[boardTurnIndex % activeTurnOrder.length]
          : "";
      setSelectedTeamId(boardId);
    } else {
      setLyricsRevealed([]);
      setLyricsPotential(0);
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
    setLyricsPotential(0);
    setJokerRound(null);
    setJokerProgress(null);
    setShowJokerConfetti(false);
    resetTimelineState();
    setMcqEliminated([]);
    setMcqResolved(false);
    setMcqResolvedInfo(null);
  };

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
      const redCount = Math.max(1, lyricsPattern.length);
      const basePoints = activeQuestion?.points ?? 0;
      const totalTiles = Math.max(1, activeQuestion?.lyricsSegments?.length ?? 1);
      const totalRedLoss = (basePoints * redCount) / totalTiles;
      const perRedDecrement = Math.max(1, Math.round(totalRedLoss / redCount));
      const minPot = Math.max(0, Math.round(basePoints - totalRedLoss));
      setLyricsPotential((prev) => Math.max(minPot, prev - perRedDecrement));
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
    if (showFinalLeaderboard) return;
    if (finalLeaderboardShown) return;
    if (questions.length === 0) return;
    const allAnswered = questions.every((q) => q.answered);
    if (allAnswered) {
      setShowFinalLeaderboard(true);
      setFinalLeaderboardShown(true);
    }
  }, [questions, activeQuestion, showFinalLeaderboard, finalLeaderboardShown]);

  const toggleGeoLock = () => {
    if (!activeQuestion || activeQuestion.type !== "geoguesser") return;
    if (geoTimerUsed && mapLocked) return;
    if (mapLocked) {
      if (!geoCostApplied) {
        const cost = activeQuestion.geoUnlockCost ?? 0;
        if (cost > 0) {
          setGeoPotential((prev) => Math.max(0, prev - cost));
        }
        setGeoCostApplied(true);
      }
      const duration = activeQuestion.geoTimerSeconds ?? 10;
      setGeoTimerUsed(true);
      setGeoCountdown(duration);
      setMapLocked(false);
    } else {
      setMapLocked(true);
      setGeoCountdown(null);
    }
  };

  const markAnswered = (correct: boolean) => {
    if (!activeQuestion) return;
    const basePoints = activeQuestion.points ?? 0;
    const teamIdToScore =
      activeQuestion.type === "lyrics"
        ? getLyricsTeamId()
        : lastGuessTeamId || selectedTeamId || getBoardTeamId();

    const rewardPoints =
      activeQuestion.type === "geoguesser"
        ? Math.max(0, geoPotential)
        : activeQuestion.type === "lyrics"
          ? Math.max(0, lyricsPotential || basePoints)
          : basePoints;
    const penaltyPoints =
      activeQuestion.type === "geoguesser"
        ? basePoints + (geoCostApplied ? activeQuestion.geoUnlockCost ?? 0 : 0)
        : activeQuestion.type === "lyrics"
          ? basePoints
          : basePoints;

    if (teamIdToScore) {
      setTeams((prev) =>
        prev.map((team) =>
          team.id === teamIdToScore
            ? {
                ...team,
                score: team.score + (correct ? rewardPoints : -penaltyPoints),
              }
            : team,
        ),
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
    const delta = correct ? incrementVal : -incrementVal;
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
      setTeams((prev) =>
        prev.map((team) =>
          team.id === teamId
            ? { ...team, score: team.score + Math.max(0, jokerProgress.score) }
            : team,
        ),
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
        setTeams((prev) =>
          prev.map((team) =>
            team.id === currentTeamId
              ? { ...team, score: team.score + awarded }
              : team,
          ),
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
      if (currentTeamId) {
        const penalty = activeQuestion.points ?? 0;
        setTeams((prev) =>
          prev.map((team) =>
            team.id === currentTeamId
              ? { ...team, score: team.score - penalty }
              : team,
          ),
        );
        const team = teams.find((t) => t.id === currentTeamId);
        setMcqResolvedInfo({
          teamName: team?.name ?? "Team",
          points: -penalty,
        });
      }
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === activeQuestion.id ? { ...q, answered: true } : q,
        ),
      );
      setMcqResolved(true);
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

    if (correct) {
      setTimelineLastCorrectTeamId(currentTeamId || null);
      playSuccessChime();
    } else {
      playDownbeat();
      // If teams are not rotating on miss, progressively lower the potential score.
      if (!rotateOnMiss) {
        const basePoints = activeQuestion.points ?? timelinePotential ?? 0;
        const eventCount = Math.max(1, activeQuestion.timelineEvents?.length ?? 1);
        const decrement = Math.ceil(basePoints / eventCount);
        setTimelinePotential((prev) => Math.max(0, prev - decrement));
      }
    }

    setTimelineQueue(remaining);
    if (!correct && remaining.length > 0 && rotateOnMiss) {
      advanceTimelineTeam();
    }

    if (remaining.length === 0) {
      let winner: string | null = null;
      if (correct) {
        winner = currentTeamId;
      } else if (rotateOnMiss) {
        const orderList =
          turnOrder.length > 0 ? activeTurnOrder : teams.map((t) => t.id);
        if (orderList.length > 0) {
          const nextIdx =
            orderList.findIndex((id) => id === currentTeamId) >= 0
              ? (orderList.findIndex((id) => id === currentTeamId) + 1) % orderList.length
              : 0;
          winner = orderList[nextIdx];
        }
      } else {
        winner = currentTeamId;
      }

      if (winner) {
        const winnerTeam = teams.find((t) => t.id === winner);
        setTimelineWinnerName(winnerTeam?.name ?? null);
        setTimelineWinnerId(winnerTeam?.id ?? null);
        setTimelineNoWinner(false);
        setTeams((teamsPrev) =>
          teamsPrev.map((t) =>
            t.id === winner ? { ...t, score: t.score + timelinePotential } : t,
          ),
        );
      } else {
        setTimelineWinnerName(null);
        setTimelineWinnerId(null);
        setTimelineNoWinner(true);
      }
      setQuestions((qs) =>
        qs.map((q) => (q.id === activeQuestion.id ? { ...q, answered: true } : q)),
      );
      if (activeTurnOrder.length > 0) {
        advanceBoard();
      }
      // keep modal open so hosts can review the timeline; allow manual close
    }
  };

  const adjustScore = (teamId: string, delta: number) => {
    setTeams((prev) =>
      prev.map((team) =>
        team.id === teamId ? { ...team, score: team.score + delta } : team,
      ),
    );
  };

  const setScore = (teamId: string, value: number) => {
    setTeams((prev) =>
      prev.map((team) =>
        team.id === teamId ? { ...team, score: value } : team,
      ),
    );
  };

  const renderModal = () => {
    if (!activeQuestion) return null;
    const answerVideoUrl = buildVideoSrc(
      activeQuestion.answerVideoUrl || null,
      activeQuestion.answerVideoAutoplay ?? true,
    );

    if (activeQuestion.type === "lyrics") {
      return (
        <LyricsModal
          question={activeQuestion}
          teams={teams}
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
          answerVideoUrl={answerVideoUrl}
          potentialPoints={lyricsPotential || activeQuestion.points}
          basePoints={activeQuestion.points}
          onNextTeam={handleLyricsNextTeam}
          onCorrect={() => markAnswered(true)}
          onWrong={() => markAnswered(false)}
          disableActions={!answeringTeam}
          onClose={closeModal}
        />
      );
    }
    if (activeQuestion.type === "geoguesser") {
      return (
        <GeoguesserModal
          question={activeQuestion}
          teams={teams}
          currentTeamName={currentTeam?.name}
          answeringTeamColor={answeringTeamColor}
          answeringTeamName={answeringTeam?.name}
          answeringTeamEmoji={answeringTeamEmoji}
          mapLocked={mapLocked}
          onToggleLock={toggleGeoLock}
          onClose={closeModal}
          onRevealAnswer={() => setShowAnswer(true)}
          showAnswer={showAnswer}
          onCorrect={() => markAnswered(true)}
          onWrong={() => markAnswered(false)}
          disableActions={!answeringTeam}
          countdownSeconds={geoCountdown}
          timerUsed={geoTimerUsed}
        />
      );
    }
    if (activeQuestion.type === "mcq") {
      return (
        <McqModal
          question={activeQuestion}
          teams={teams}
          currentTeamName={currentTeam?.name}
          currentTeamColor={currentTeamColor}
          currentTeamEmoji={currentTeamEmoji}
          answeringTeamName={answeringTeam?.name}
          answeringTeamColor={answeringTeamColor}
          answeringTeamEmoji={answeringTeamEmoji}
          eliminated={mcqEliminated}
          onSelect={handleMcqSelect}
          onClose={closeModal}
          resolved={mcqResolved}
          correctIndex={activeQuestion.mcqCorrectIndex ?? 0}
          resolvedInfo={mcqResolvedInfo}
        />
      );
    }
    if (activeQuestion.type === "joker" && jokerRound && jokerProgress) {
      return (
        <JokerModal
          question={activeQuestion}
          teams={teams}
          currentTeamName={currentTeam?.name}
          currentTeamColor={currentTeamColor}
          answeringTeamName={answeringTeam?.name}
          answeringTeamEmoji={answeringTeamEmoji}
          round={jokerRound}
          progress={jokerProgress}
          onGuess={handleJokerGuess}
          onFinish={finishJokerQuestion}
          onClose={closeModal}
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
          category={activeQuestion.category}
          centerYear={timelineCenterYear}
          currentTeamName={timelineTeam?.name}
          currentTeamColor={timelineTeam?.accentBase || "#f2c14f"}
          currentTeamEmoji={timelineTeamEmoji}
          queue={timelineQueue ?? []}
          placedLeft={timelinePlacedLeft ?? []}
          placedRight={timelinePlacedRight ?? []}
          onPlace={handleTimelinePlace}
          onClose={closeModal}
          disableActions={!timelineTeamId}
          winnerName={timelineWinnerName}
          winnerTeamId={timelineWinnerId}
          winnerTeamColor={
            timelineWinnerId ? teams.find((t) => t.id === timelineWinnerId)?.accentBase : undefined
          }
          winnerTeamEmoji={
            timelineWinnerId ? teams.find((t) => t.id === timelineWinnerId)?.badgeEmoji : undefined
          }
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
          question={activeQuestion}
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
          onClose={closeModal}
          disableActions={!answeringTeam}
        />
      );
    }
    return (
      <StandardModal
        question={activeQuestion}
        teams={teams}
        currentTeamName={currentTeam?.name}
        currentTeamColor={currentTeamColor}
        currentTeamEmoji={currentTeamEmoji}
        answeringTeamName={answeringTeam?.name}
        answeringTeamColor={answeringTeamColor}
        answeringTeamEmoji={answeringTeamEmoji}
        onClose={closeModal}
        onRevealAnswer={() => setShowAnswer(true)}
        showAnswer={showAnswer}
        onCorrect={() => markAnswered(true)}
        onWrong={() => markAnswered(false)}
        disableActions={!answeringTeam}
      />
    );
  };

  return (
    <main style={{ display: "grid", gap: "18px" }}>
      <style>
        {`@keyframes slot-shimmer {
            0% { transform: translateY(-110%); }
            100% { transform: translateY(110%); }
          }
          @keyframes slot-jump {
            0% { transform: translateY(0) scale(1); }
            25% { transform: translateY(-12px) scale(1.05); }
            50% { transform: translateY(0px) scale(1); }
            75% { transform: translateY(-6px) scale(1.02); }
            100% { transform: translateY(0) scale(1); }
          }`}
      </style>
      <section className="card" style={{ padding: "18px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "8px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: "220px" }}>
            <h1 style={{ margin: 0 }}>Game Board</h1>
            <p
              style={{
                color: "var(--muted)",
                marginTop: "6px",
                lineHeight: 1.4,
                minHeight: "60px",
                display: "grid",
                alignItems: "center",
              }}
            >
              <span>Click a tile to open the question.</span>
              <span>Wrong answers subtract points.</span>
              <span>Adjust scores in the leaderboard panel.</span>
            </p>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "10px",
              minWidth: "280px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 10px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.03)",
                  boxShadow: slotSpinning ? "0 0 0 2px rgba(255,255,255,0.06)" : "none",
                  minWidth: "200px",
                  position: "relative",
                  justifyContent: "center",
                }}
              >
                {slotSpinning && (
                  <span style={{ color: "var(--muted)", fontSize: "0.9rem", minWidth: "84px", textAlign: "right" }}>
                    Spinning…
                  </span>
                )}
                {teams.length === 0 ? (
                  <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Add teams to spin</span>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    {slotCollapsed && !slotSpinning ? (
                      currentTeam && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center", textAlign: "center" }}>
                          <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Board turn</span>
                          <TeamPill
                            name={currentTeam.name}
                            color={currentTeam.accentBase ?? "#f2c14f"}
                            emoji={currentTeam.badgeEmoji ?? "⭐️"}
                          />
                        </div>
                      )
                    ) : (
                      (slotFaces.length > 0 ? slotFaces : teams.slice(0, Math.min(3, teams.length))).map((team, idx) => {
                        const isActive = slotCollapsed && !slotSpinning && team?.id && currentTeam?.id && team.id === currentTeam.id;
                        const cardWidth = isActive && !slotSpinning ? "78px" : "64px";
                        const cardHeight = isActive && !slotSpinning ? "72px" : "58px";
                        const scaleRest = isActive && !slotSpinning ? 1.08 : 0.92;
                        const scaleSpin = isActive && !slotSpinning ? 1.02 : 0.96;
                        const bob = slotSpinning ? (idx % 2 === 0 ? "-4px" : "4px") : "0px";
                        const baseBorder =
                          team?.accentBase
                            ? `${team.accentBase}${isActive ? "cc" : "80"}`
                            : "rgba(255,255,255,0.18)";
                        const transformValue = slotSpinning
                          ? `translateY(${bob}) scale(${scaleSpin})`
                          : `scale(${scaleRest})`;
                        const canJump = !slotSpinning && activeTurnOrder.length === 0;
                        const isJumping = slotJumpId && slotJumpId === team?.id;
                        return (
                        <div
                          key={team?.id ?? `slot-${idx}`}
                          title={team?.name ?? "Team"}
                          aria-label={team?.name ?? "Team"}
                          style={{
                            width: cardWidth,
                            height: cardHeight,
                            borderRadius: "8px",
                            background: team?.accentGlow
                              ? `${team.accentGlow}33`
                              : "rgba(255,255,255,0.05)",
                            border: isActive && !slotSpinning
                              ? `2px solid ${baseBorder}`
                              : `1px solid ${baseBorder}`,
                            display: "grid",
                            placeItems: "center",
                            position: "relative",
                            overflow: "hidden",
                            transition: "transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease",
                            boxShadow: slotSpinning
                              ? "0 3px 12px rgba(0,0,0,0.2)"
                              : isActive
                                ? `0 6px 18px ${team?.accentBase ? `${team.accentBase}3d` : "rgba(0,0,0,0.3)"}`
                                : "0 1px 4px rgba(0,0,0,0.18)",
                            transform: transformValue,
                            outline: isActive && !slotSpinning ? `2px solid ${team?.accentBase ?? "rgba(255,255,255,0.25)"}` : "none",
                            outlineOffset: "2px",
                            cursor: canJump ? "pointer" : "default",
                          }}
                          onClick={() => {
                            if (!canJump || !team?.id) return;
                            setSlotJumpId(team.id);
                            setSlotJumpKey(Date.now());
                            setTimeout(() => setSlotJumpId(null), 650);
                            playBoing();
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              background: slotSpinning
                                ? "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)"
                                : "none",
                              animation: slotSpinning ? "slot-shimmer 0.65s linear infinite" : "none",
                              pointerEvents: "none",
                              willChange: "transform",
                            }}
                            aria-hidden
                          />
                          <div
                            key={isJumping && canJump ? slotJumpKey : `emoji-${team?.id ?? idx}`}
                            style={{
                              fontSize: isActive && !slotSpinning ? "26px" : "22px",
                              marginTop: "2px",
                              animation:
                                isJumping && canJump
                                  ? `slot-jump 0.65s ease-out`
                                  : "none",
                              willChange: "transform",
                            }}
                          >
                            {team?.badgeEmoji ?? "❔"}
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              bottom: "8px",
                              left: "8px",
                              right: "8px",
                              height: "6px",
                              borderRadius: "999px",
                              background: team?.accentBase
                                ? `linear-gradient(90deg, ${team.accentBase}, ${team.accentGlow ?? team.accentBase})`
                                : "rgba(255,255,255,0.12)",
                              boxShadow: team?.accentBase ? `0 0 0 2px ${team.accentBase}22` : "none",
                            }}
                          />
                        </div>
                      );
                      })
                    )}
                  </div>
                )}
              </div>
              <button
              className="button ghost"
              onClick={startTurnOrder}
              style={{ paddingInline: "8px", minWidth: "110px", cursor: "pointer" }}
              disabled={slotSpinning || teams.length === 0}
            >
              {slotSpinning ? "Spinning…" : "Spin!"}
            </button>
            </div>
          </div>
        </div>

        {categories.length === 0 ? (
          <div className="card" style={{ padding: "16px", color: "var(--muted)" }}>
            Add categories and questions first in the config pages.
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <BoardGrid categories={categories} questions={questions} onOpen={openQuestion} />
            {!activeTurnOrder.length && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.65)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  textAlign: "center",
                  padding: "20px",
                  zIndex: 2,
                }}
              >
                <p style={{ margin: 0, color: "#e5e7eb", fontSize: "1rem", fontWeight: 600 }}>
                  Spin the order before playing
                </p>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
                  Use the slot machine to set the board turn order.
                </p>
                <button className="button primary" onClick={startTurnOrder} disabled={slotSpinning || teams.length === 0}>
                  {slotSpinning ? "Spinning…" : "Spin now"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <Leaderboard teams={sortedTeams} onAdjust={adjustScore} onSet={setScore} />
      {boardComplete && finalLeaderboardShown && !showFinalLeaderboard && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            className="button primary"
            onClick={() => setShowFinalLeaderboard(true)}
            style={{ marginTop: "-6px" }}
          >
            Show podium again
          </button>
        </div>
      )}

      {activeQuestion && (
        <div
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
          onClick={closeModal}
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
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 30,
            padding: "20px",
          }}
          onClick={closeFinalLeaderboard}
        >
          <div
            className="card"
            style={{
              position: "relative",
              maxWidth: "760px",
              width: "min(92vw, 760px)",
              padding: "24px",
              background: "linear-gradient(145deg, rgba(18,22,34,0.95), rgba(26,30,46,0.95))",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 18px 48px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div
                  style={{
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                    fontWeight: 800,
                  }}
                >
                  All questions answered
                </div>
                <h2 style={{ margin: "6px 0 2px", fontSize: "2.2rem" }}>Final leaderboard</h2>
                <div style={{ color: "var(--muted)" }}>Tap outside or hit close</div>
              </div>
              <button
                className="button ghost"
                onClick={closeFinalLeaderboard}
                style={{ marginLeft: "12px", whiteSpace: "nowrap" }}
                aria-label="Close final leaderboard"
              >
                Close
              </button>
            </div>
            <div style={{ marginTop: "18px", display: "grid", gap: "12px" }}>
              {sortedTeams.slice(0, 3).map((team, idx) => {
                const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
                return (
                  <div
                    key={team.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      alignItems: "center",
                      gap: "10px",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background:
                        idx === 0
                          ? "linear-gradient(90deg, rgba(255,215,0,0.12), rgba(255,215,0,0.04))"
                          : idx === 1
                          ? "linear-gradient(90deg, rgba(192,192,192,0.14), rgba(192,192,192,0.05))"
                          : idx === 2
                          ? "linear-gradient(90deg, rgba(205,127,50,0.16), rgba(205,127,50,0.06))"
                          : "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div style={{ fontSize: "1.8rem" }}>{medal}</div>
                    <div style={{ display: "grid", gap: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, fontSize: "1.2rem" }}>
                      <span>{team.badgeEmoji || "⭐️"}</span>
                      <span>{team.name}</span>
                    </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                          color: "var(--muted)",
                        }}
                      >
                        {team.players.map((p) => (
                          <span
                            key={p.id}
                            className="jumping-name"
                            style={{
                              padding: "4px 8px",
                              borderRadius: "999px",
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              fontSize: "0.95rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              animationDelay: `${Math.random() * 0.6}s`,
                            }}
                          >
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{team.score} pts</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
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
        @keyframes jumpy {
          0% { transform: translateY(0); }
          25% { transform: translateY(-6px) rotate(-1deg); }
          50% { transform: translateY(2px) rotate(1deg); }
          75% { transform: translateY(-4px) rotate(-0.5deg); }
          100% { transform: translateY(0); }
        }
        .jumping-name {
          animation: jumpy 1.6s ease-in-out infinite;
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
    setShowFinalLeaderboard(false);
    setFinalLeaderboardShown(true);
  }
}
