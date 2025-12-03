'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { BoardGrid } from "@/components/game/BoardGrid";
import { Leaderboard } from "@/components/game/Leaderboard";
import { GeoguesserModal } from "@/components/game/modals/GeoguesserModal";
import { LyricsModal } from "@/components/game/modals/LyricsModal";
import { StandardModal } from "@/components/game/modals/StandardModal";
import { useAudioCue } from "@/hooks/useAudioCue";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useTurnState } from "@/hooks/useTurnState";
import { generateRedPattern, shuffle } from "@/lib/redPattern";
import { QUESTION_STORAGE_KEY, TEAM_STORAGE_KEY } from "@/lib/storage";
import { type Question, type Team } from "@/lib/types";

type ActiveQuestion = Question & { category: string };
export default function GameBoardPage() {
  const { playSadBlip, playCountdownBeep, playFinalAlarm } = useAudioCue();
  const [teams, setTeams] = usePersistentState<Team[]>(TEAM_STORAGE_KEY, []);
  const [questions, setQuestions] = usePersistentState<Question[]>(
    QUESTION_STORAGE_KEY,
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
  const prevAnsweringTeamRef = useRef<string | null>(null);

  const { turnState, setOrder, advanceBoard, advanceLyrics } = useTurnState();
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
  const activeTurnOrder = useMemo(
    () => turnOrder.filter((id) => teams.some((t) => t.id === id)),
    [turnOrder, teams],
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

  const startTurnOrder = () => {
    if (teams.length === 0) return;
    const shuffled = shuffle([...teams].map((t) => t.id));
    setOrder(shuffled);
    setSelectedTeamId("");
  };

  const openQuestion = (question: Question) => {
    let normalized = question;
    if (question.type === "lyrics") {
      const pattern = generateRedPattern(question.lyricsSegments?.length ?? 0);
      normalized = { ...question, lyricsRedPattern: pattern };
      setLyricsPattern(pattern);
    }
    if (question.type === "geoguesser") {
      const duration = question.geoTimerSeconds ?? 10;
      normalized = { ...question, geoTimerSeconds: duration };
    }
    setActiveQuestion(normalized);
    setShowAnswer(false);
    setGeoTimerUsed(false);
    setGeoCountdown(null);
    setMapLocked(true);
    if (normalized.type === "lyrics") {
      const len = normalized.lyricsSegments?.length ?? 0;
      setLyricsRevealed(new Array(len).fill(false));
      const lyricId =
        activeTurnOrder.length > 0
          ? activeTurnOrder[lyricsTurnIndex % activeTurnOrder.length]
          : "";
      setSelectedTeamId(lyricId);
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
      advanceLyrics();
    }
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

  const toggleGeoLock = () => {
    if (!activeQuestion || activeQuestion.type !== "geoguesser") return;
    if (geoTimerUsed && mapLocked) return;
    if (mapLocked) {
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
    const teamIdToScore =
      activeQuestion.type === "lyrics"
        ? getLyricsTeamId()
        : lastGuessTeamId || selectedTeamId || getBoardTeamId();

    if (teamIdToScore) {
      setTeams((prev) =>
        prev.map((team) =>
          team.id === teamIdToScore
            ? {
                ...team,
                score: team.score + (correct ? activeQuestion.points : -activeQuestion.points),
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
      if (activeQuestion.type !== "lyrics") {
        // keep lyrics order as-is for non-lyrics
      }
    }
    setLastGuessTeamId("");
    closeModal();
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
          answeringTeamName={answeringTeam?.name}
          answerVideoUrl={answerVideoUrl}
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
          answeringTeamName={answeringTeam?.name}
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
  return (
      <StandardModal
        question={activeQuestion}
        teams={teams}
        currentTeamName={currentTeam?.name}
        answeringTeamName={answeringTeam?.name}
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
      <section className="card" style={{ padding: "18px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          <div>
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
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div
              style={{
                color: "var(--muted)",
                fontSize: "0.95rem",
                minWidth: "220px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {turnOrder.length > 0 && currentTeam ? (
                <div style={{ display: "grid", gap: "2px" }}>
                  <div>{activeQuestion?.type === "lyrics" ? "Lyrics turn" : "Board turn"}</div>
                  <div style={{ display: "grid", gap: "2px" }}>
                    <span>Current:</span>
                    <strong style={{ color: "#f2c14f" }}>{currentTeam.name}</strong>
                  </div>
                </div>
              ) : (
                "Set random answer order"
              )}
            </div>
            <button className="button secondary" onClick={startTurnOrder}>
              Randomize answer order
            </button>
          </div>
        </div>

        {categories.length === 0 ? (
          <div className="card" style={{ padding: "16px", color: "var(--muted)" }}>
            Add categories and questions first in the config pages.
          </div>
        ) : (
          <BoardGrid categories={categories} questions={questions} onOpen={openQuestion} />
        )}
      </section>

      <Leaderboard teams={sortedTeams} onAdjust={adjustScore} onSet={setScore} />

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
      `}</style>
    </main>
  );
}
